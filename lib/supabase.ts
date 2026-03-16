import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Server-side client with service role (full access)
export const supabaseAdmin = supabaseUrl
  ? createClient(supabaseUrl, supabaseServiceKey)
  : (null as unknown as ReturnType<typeof createClient>)

// Client-side client with anon key (RLS enforced)
export const supabaseClient = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as unknown as ReturnType<typeof createClient>)

// Types
export interface User {
  id: string
  phone_number: string
  stripe_customer_id: string | null
  re_engagement_commitment_id: string | null
  re_engagement_touch: number
  re_engagement_window_closes_at: string | null
  created_at: string
}

export interface Commitment {
  id: string
  user_id: string
  goal_text: string
  goal_parsed: {
    type: 'frequency' | 'deadline' | 'abstinence' | 'habit'
    description: string
    verification_method: string
    proof_instructions: string
  } | null
  verification_method: string
  cadence: {
    type: 'daily' | 'frequency' | 'deadline' | 'abstinence'
    days?: string[]
    reminder_time: string
    proof_deadline_time: string
    allowed_misses: number
  }
  failure_modes: {
    max_consecutive_misses: number
    max_total_misses: number
    deadline_hard: boolean
  }
  stake_amount: number
  charity_id: string | null
  stripe_payment_intent_id: string | null
  stripe_setup_intent_id: string | null
  status: 'pending_payment' | 'active' | 'completed' | 'failed' | 'cancelled'
  is_public: boolean
  slug: string | null
  starts_at: string | null
  ends_at: string | null
  timezone: string
  created_at: string
  conversation_state: ConversationState | null
  // Joined fields
  user?: User
  charity?: Charity
}

export interface Proof {
  id: string
  commitment_id: string
  period_id: string | null
  submitted_at: string
  image_url: string
  gps_lat: number | null
  gps_lng: number | null
  browser_timestamp: string | null
  perceptual_hash: string | null
  status: 'submitted' | 'approved' | 'flagged' | 'rejected'
  flagged_reason: string | null
}

export interface Reminder {
  id: string
  commitment_id: string
  scheduled_for: string
  sent_at: string | null
  status: 'pending' | 'sent' | 'failed'
}

export interface Miss {
  id: string
  commitment_id: string
  missed_date: string
  period_id: string | null
  consecutive_count: number
  triggered_failure: boolean
}

export interface Charity {
  id: string
  name: string
  description: string | null
  stripe_account_id: string | null
  logo_url: string | null
  active: boolean
}

export type ConversationState = {
  state: 'collecting_goal' | 'collecting_verification' | 'collecting_cadence' | 'collecting_timezone' | 'collecting_failure_modes' | 'collecting_stake' | 'collecting_charity' | 'confirming' | 'complete'
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  extracted: {
    goal_text: string | null
    goal_type: string | null
    verification_method: string | null
    proof_instructions: string | null
    cadence: Commitment['cadence'] | null
    failure_modes: Commitment['failure_modes'] | null
    stake_amount: number | null
    charity_id: string | null
    timezone: string | null
  }
}

// Helper functions
export async function getOrCreateUser(phoneNumber: string): Promise<User> {
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()

  if (existing) return existing as User

  const { data: created, error } = await supabaseAdmin
    .from('users')
    .insert({ phone_number: phoneNumber })
    .select('*')
    .single()

  if (error) throw error
  return created as User
}

export async function getActiveCommitment(userId: string): Promise<Commitment | null> {
  const { data } = await supabaseAdmin
    .from('commitments')
    .select('*, charity:charities(*)')
    .eq('user_id', userId)
    .in('status', ['pending_payment', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data as Commitment | null
}

export async function getPendingCommitment(userId: string): Promise<Commitment | null> {
  const { data } = await supabaseAdmin
    .from('commitments')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending_payment')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data as Commitment | null
}

export async function getCommitment(commitmentId: string): Promise<Commitment & { user: User; charity: Charity }> {
  const { data, error } = await supabaseAdmin
    .from('commitments')
    .select('*, user:users(*), charity:charities(*)')
    .eq('id', commitmentId)
    .single()

  if (error) throw error
  return data as Commitment & { user: User; charity: Charity }
}

export async function getCommitmentBySlug(slug: string): Promise<(Commitment & { user: User; charity: Charity }) | null> {
  const { data } = await supabaseAdmin
    .from('commitments')
    .select('*, user:users(*), charity:charities(*)')
    .eq('slug', slug)
    .single()

  return data as (Commitment & { user: User; charity: Charity }) | null
}

export async function getProofsForCommitment(commitmentId: string): Promise<Proof[]> {
  const { data } = await supabaseAdmin
    .from('proofs')
    .select('*')
    .eq('commitment_id', commitmentId)
    .order('submitted_at', { ascending: true })

  return (data || []) as Proof[]
}

export async function getMissesForCommitment(commitmentId: string): Promise<Miss[]> {
  const { data } = await supabaseAdmin
    .from('misses')
    .select('*')
    .eq('commitment_id', commitmentId)
    .order('missed_date', { ascending: true })

  return (data || []) as Miss[]
}

export async function getCharities(): Promise<Charity[]> {
  const { data } = await supabaseAdmin
    .from('charities')
    .select('*')
    .eq('active', true)
    .order('name')

  return (data || []) as Charity[]
}

export async function wasProofSubmitted(commitmentId: string, periodId: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from('proofs')
    .select('*', { count: 'exact', head: true })
    .eq('commitment_id', commitmentId)
    .eq('period_id', periodId)
    .in('status', ['submitted', 'approved'])

  return (count || 0) > 0
}

export async function recordMiss(commitmentId: string, periodId: string): Promise<{ triggersFailure: boolean }> {
  const commitment = await getCommitment(commitmentId)
  const misses = await getMissesForCommitment(commitmentId)

  // Calculate consecutive count
  const recentMisses = misses.filter(m => !m.triggered_failure)
  const consecutiveCount = recentMisses.length > 0
    ? recentMisses[recentMisses.length - 1].consecutive_count + 1
    : 1

  const totalMisses = misses.length + 1
  const { max_consecutive_misses, max_total_misses } = commitment.failure_modes

  const triggersFailure =
    consecutiveCount >= max_consecutive_misses ||
    totalMisses >= max_total_misses

  await supabaseAdmin.from('misses').insert({
    commitment_id: commitmentId,
    missed_date: new Date().toISOString().split('T')[0],
    period_id: periodId,
    consecutive_count: consecutiveCount,
    triggered_failure: triggersFailure,
  })

  return { triggersFailure }
}

export async function updateCommitmentStatus(
  commitmentId: string,
  status: Commitment['status']
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('commitments')
    .update({ status })
    .eq('id', commitmentId)

  if (error) throw error
}
