import { callAgent, type AgentResponse } from './anthropic'
import {
  supabaseAdmin,
  getOrCreateUser,
  getActiveCommitment,
  getPendingCommitment,
  getCharities,
  type User,
  type Commitment,
  type ConversationState,
} from './supabase'
import { getOrCreateStripeCustomer, createSetupIntent } from './stripe'
import { sendSMS } from './twilio'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://uwatchu.com'

function generateSlug(): string {
  const adjectives = ['cold', 'iron', 'dark', 'grim', 'stark', 'hard', 'dead', 'raw', 'bare', 'flat']
  const nouns = ['watch', 'steel', 'stone', 'chain', 'lock', 'bolt', 'edge', 'grip', 'mark', 'wire']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${adj}-${noun}-${suffix}`
}

function initConversationState(): ConversationState {
  return {
    state: 'collecting_goal',
    messages: [],
    extracted: {
      goal_text: null,
      goal_type: null,
      verification_method: null,
      proof_instructions: null,
      cadence: null,
      failure_modes: null,
      stake_amount: null,
      charity_id: null,
    },
  }
}

export async function handleInboundSMS(
  phoneNumber: string,
  messageBody: string
): Promise<string> {
  const user = await getOrCreateUser(phoneNumber)

  // Check for re-engagement response
  if (
    user.re_engagement_touch > 0 &&
    user.re_engagement_window_closes_at &&
    new Date(user.re_engagement_window_closes_at) > new Date()
  ) {
    // Clear re-engagement state and start new intake
    await supabaseAdmin
      .from('users')
      .update({
        re_engagement_touch: 0,
        re_engagement_commitment_id: null,
        re_engagement_window_closes_at: null,
      })
      .eq('id', user.id)

    return await startNewIntake(user, messageBody)
  }

  // Check for active commitment
  const active = await getActiveCommitment(user.id)

  if (active && active.status === 'active') {
    // User has active commitment — treat as a message, not new intake
    return `UWATCHU: You have an active commitment. Submit proof at ${BASE_URL}/g/${active.slug}/prove`
  }

  // Check for pending commitment (in conversation)
  const pending = await getPendingCommitment(user.id)

  if (pending?.conversation_state) {
    return await continueConversation(user, pending, messageBody)
  }

  // No active or pending — start new intake
  return await startNewIntake(user, messageBody)
}

async function startNewIntake(user: User, messageBody: string): Promise<string> {
  const convState = initConversationState()
  convState.messages.push({ role: 'user', content: messageBody })

  const charities = await getCharities()
  const charitiesList = charities
    .map((c, i) => `${i + 1}. ${c.name} — ${c.description || ''}`)
    .join('\n')

  const agentResponse = await callAgent(convState.messages, charitiesList)

  convState.state = agentResponse.state as ConversationState['state']
  convState.extracted = agentResponse.extracted
  convState.messages.push({
    role: 'assistant',
    content: JSON.stringify(agentResponse),
  })

  // Create pending commitment
  const slug = generateSlug()
  await supabaseAdmin.from('commitments').insert({
    user_id: user.id,
    goal_text: messageBody,
    verification_method: 'pending',
    cadence: { type: 'daily', reminder_time: '09:00', proof_deadline_time: '22:00', allowed_misses: 0 },
    failure_modes: { max_consecutive_misses: 2, max_total_misses: 5, deadline_hard: true },
    stake_amount: 0,
    status: 'pending_payment',
    slug,
    conversation_state: convState,
  })

  return agentResponse.reply
}

async function continueConversation(
  user: User,
  commitment: Commitment,
  messageBody: string
): Promise<string> {
  const convState = commitment.conversation_state!
  convState.messages.push({ role: 'user', content: messageBody })

  const charities = await getCharities()
  const charitiesList = charities
    .map((c, i) => `${i + 1}. ${c.name} — ${c.description || ''}`)
    .join('\n')

  const agentResponse = await callAgent(convState.messages, charitiesList)

  convState.state = agentResponse.state as ConversationState['state']
  // Merge extracted — keep non-null values
  for (const key of Object.keys(agentResponse.extracted) as Array<keyof typeof agentResponse.extracted>) {
    if (agentResponse.extracted[key] !== null) {
      (convState.extracted as Record<string, unknown>)[key] = agentResponse.extracted[key]
    }
  }
  convState.messages.push({
    role: 'assistant',
    content: JSON.stringify(agentResponse),
  })

  // Update commitment with latest conversation state and extracted data
  const updateData: Record<string, unknown> = {
    conversation_state: convState,
  }

  if (convState.extracted.goal_text) {
    updateData.goal_text = convState.extracted.goal_text
  }
  if (convState.extracted.verification_method) {
    updateData.verification_method = convState.extracted.verification_method
  }
  if (convState.extracted.cadence) {
    updateData.cadence = convState.extracted.cadence
  }
  if (convState.extracted.failure_modes) {
    updateData.failure_modes = convState.extracted.failure_modes
  }
  if (convState.extracted.stake_amount) {
    updateData.stake_amount = convState.extracted.stake_amount
  }
  if (convState.extracted.charity_id) {
    updateData.charity_id = convState.extracted.charity_id
  }
  if (convState.extracted.goal_type || convState.extracted.proof_instructions) {
    updateData.goal_parsed = {
      type: convState.extracted.goal_type,
      description: convState.extracted.goal_text,
      verification_method: convState.extracted.verification_method,
      proof_instructions: convState.extracted.proof_instructions,
    }
  }

  await supabaseAdmin
    .from('commitments')
    .update(updateData)
    .eq('id', commitment.id)

  // If ready to create — finalize and send Stripe setup link
  if (agentResponse.ready_to_create) {
    await finalizeCommitment(user, commitment.id)
  }

  return agentResponse.reply
}

async function finalizeCommitment(user: User, commitmentId: string): Promise<void> {
  const { data: commitment } = await supabaseAdmin
    .from('commitments')
    .select('*')
    .eq('id', commitmentId)
    .single()

  if (!commitment) return

  // Set start/end dates
  const startsAt = new Date()
  const cadence = commitment.cadence as Commitment['cadence']
  let endDays = 28 // default 4 weeks
  if (cadence.type === 'deadline') {
    // Keep whatever was negotiated
    endDays = 30
  }
  const endsAt = new Date(startsAt.getTime() + endDays * 24 * 60 * 60 * 1000)

  // Create Stripe setup
  const customerId = await getOrCreateStripeCustomer(user.id, user.phone_number)
  const setupIntent = await createSetupIntent(
    customerId,
    commitmentId,
    commitment.stake_amount
  )

  await supabaseAdmin
    .from('commitments')
    .update({
      stripe_setup_intent_id: setupIntent.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .eq('id', commitmentId)

  // Send payment setup link
  const setupUrl = `${BASE_URL}/api/stripe/setup/${commitmentId}`
  await sendSMS(
    user.phone_number,
    `UWATCHU: To lock in your stake, add your card: ${setupUrl}`
  )
}
