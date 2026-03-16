/**
 * In-memory database for dev mode. Replaces Supabase when no connection is configured.
 * Data persists across hot reloads via globalThis but resets on server restart.
 */

import type { User, Commitment, Proof, Reminder, Miss, Charity } from './supabase'

interface DevDB {
  users: User[]
  commitments: Commitment[]
  proofs: Proof[]
  reminders: Reminder[]
  misses: Miss[]
  charities: Charity[]
}

const globalForDevDB = globalThis as unknown as { __devDB?: DevDB }

function seedCharities(): Charity[] {
  return [
    { id: crypto.randomUUID(), name: 'Doctors Without Borders', description: 'International medical humanitarian organization', stripe_account_id: null, logo_url: null, active: true },
    { id: crypto.randomUUID(), name: 'American Red Cross', description: 'Humanitarian organization providing emergency assistance', stripe_account_id: null, logo_url: null, active: true },
    { id: crypto.randomUUID(), name: 'World Wildlife Fund', description: 'International conservation organization', stripe_account_id: null, logo_url: null, active: true },
    { id: crypto.randomUUID(), name: 'Feeding America', description: 'Nationwide network of food banks', stripe_account_id: null, logo_url: null, active: true },
    { id: crypto.randomUUID(), name: 'UNICEF', description: "United Nations Children's Fund", stripe_account_id: null, logo_url: null, active: true },
  ]
}

if (!globalForDevDB.__devDB) {
  globalForDevDB.__devDB = {
    users: [],
    commitments: [],
    proofs: [],
    reminders: [],
    misses: [],
    charities: seedCharities(),
  }
}

export const devDB = globalForDevDB.__devDB

// Helper: deep clone to avoid mutation bugs
function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

// ---- User operations ----

export function devGetOrCreateUser(phoneNumber: string): User {
  let user = devDB.users.find((u) => u.phone_number === phoneNumber)
  if (user) return clone(user)

  user = {
    id: crypto.randomUUID(),
    phone_number: phoneNumber,
    stripe_customer_id: null,
    re_engagement_commitment_id: null,
    re_engagement_touch: 0,
    re_engagement_window_closes_at: null,
    created_at: new Date().toISOString(),
  }
  devDB.users.push(user)
  return clone(user)
}

export function devUpdateUser(id: string, updates: Partial<User>): void {
  const idx = devDB.users.findIndex((u) => u.id === id)
  if (idx >= 0) {
    devDB.users[idx] = { ...devDB.users[idx], ...updates }
  }
}

// ---- Commitment operations ----

export function devInsertCommitment(data: Partial<Commitment>): Commitment {
  const commitment: Commitment = {
    id: data.id || crypto.randomUUID(),
    user_id: data.user_id || '',
    goal_text: data.goal_text || '',
    goal_parsed: data.goal_parsed || null,
    verification_method: data.verification_method || 'pending',
    cadence: data.cadence || { type: 'daily', reminder_time: '09:00', proof_deadline_time: '22:00', allowed_misses: 0 },
    failure_modes: data.failure_modes || { max_consecutive_misses: 2, max_total_misses: 5, deadline_hard: true },
    stake_amount: data.stake_amount || 0,
    charity_id: data.charity_id || null,
    stripe_payment_intent_id: data.stripe_payment_intent_id || null,
    stripe_setup_intent_id: data.stripe_setup_intent_id || null,
    status: data.status || 'pending_payment',
    is_public: data.is_public || false,
    slug: data.slug || null,
    starts_at: data.starts_at || null,
    ends_at: data.ends_at || null,
    timezone: data.timezone || 'America/New_York',
    created_at: data.created_at || new Date().toISOString(),
    conversation_state: data.conversation_state || null,
  }
  devDB.commitments.push(commitment)
  return clone(commitment)
}

export function devUpdateCommitment(id: string, updates: Record<string, unknown>): void {
  const idx = devDB.commitments.findIndex((c) => c.id === id)
  if (idx >= 0) {
    devDB.commitments[idx] = { ...devDB.commitments[idx], ...updates } as Commitment
  }
}

export function devGetCommitment(id: string): (Commitment & { user: User; charity: Charity }) | null {
  const c = devDB.commitments.find((c) => c.id === id)
  if (!c) return null
  const user = devDB.users.find((u) => u.id === c.user_id)!
  const charity = devDB.charities.find((ch) => ch.id === c.charity_id) || devDB.charities[0]
  return clone({ ...c, user, charity })
}

export function devGetCommitmentBySlug(slug: string): (Commitment & { user: User; charity: Charity }) | null {
  const c = devDB.commitments.find((c) => c.slug === slug)
  if (!c) return null
  const user = devDB.users.find((u) => u.id === c.user_id)!
  const charity = devDB.charities.find((ch) => ch.id === c.charity_id) || devDB.charities[0]
  return clone({ ...c, user, charity })
}

export function devGetActiveCommitment(userId: string): Commitment | null {
  const c = devDB.commitments
    .filter((c) => c.user_id === userId && ['pending_payment', 'active'].includes(c.status))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  return c ? clone(c) : null
}

export function devGetPendingCommitment(userId: string): Commitment | null {
  const c = devDB.commitments
    .filter((c) => c.user_id === userId && c.status === 'pending_payment')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  return c ? clone(c) : null
}

// ---- Proof operations ----

export function devInsertProof(data: Partial<Proof>): void {
  devDB.proofs.push({
    id: data.id || crypto.randomUUID(),
    commitment_id: data.commitment_id || '',
    period_id: data.period_id || null,
    submitted_at: data.submitted_at || new Date().toISOString(),
    image_url: data.image_url || '',
    gps_lat: data.gps_lat ?? null,
    gps_lng: data.gps_lng ?? null,
    browser_timestamp: data.browser_timestamp || null,
    perceptual_hash: data.perceptual_hash || null,
    status: data.status || 'submitted',
    flagged_reason: data.flagged_reason || null,
  })
}

export function devGetProofsForCommitment(commitmentId: string): Proof[] {
  return clone(
    devDB.proofs
      .filter((p) => p.commitment_id === commitmentId)
      .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
  )
}

export function devWasProofSubmitted(commitmentId: string, periodId: string): boolean {
  return devDB.proofs.some(
    (p) => p.commitment_id === commitmentId && p.period_id === periodId && ['submitted', 'approved'].includes(p.status)
  )
}

// ---- Miss operations ----

export function devGetMissesForCommitment(commitmentId: string): Miss[] {
  return clone(
    devDB.misses
      .filter((m) => m.commitment_id === commitmentId)
      .sort((a, b) => a.missed_date.localeCompare(b.missed_date))
  )
}

export function devRecordMiss(commitmentId: string, periodId: string): { triggersFailure: boolean } {
  const commitment = devDB.commitments.find((c) => c.id === commitmentId)
  if (!commitment) return { triggersFailure: false }

  const misses = devDB.misses.filter((m) => m.commitment_id === commitmentId)
  const recentMisses = misses.filter((m) => !m.triggered_failure)
  const consecutiveCount = recentMisses.length > 0
    ? recentMisses[recentMisses.length - 1].consecutive_count + 1
    : 1
  const totalMisses = misses.length + 1
  const { max_consecutive_misses, max_total_misses } = commitment.failure_modes
  const triggersFailure = consecutiveCount >= max_consecutive_misses || totalMisses >= max_total_misses

  devDB.misses.push({
    id: crypto.randomUUID(),
    commitment_id: commitmentId,
    missed_date: new Date().toISOString().split('T')[0],
    period_id: periodId,
    consecutive_count: consecutiveCount,
    triggered_failure: triggersFailure,
  })

  return { triggersFailure }
}

// ---- Charity operations ----

export function devGetCharities(): Charity[] {
  return clone(devDB.charities.filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name)))
}

// ---- Reminder operations ----

export function devInsertReminder(data: Partial<Reminder>): void {
  devDB.reminders.push({
    id: data.id || crypto.randomUUID(),
    commitment_id: data.commitment_id || '',
    scheduled_for: data.scheduled_for || new Date().toISOString(),
    sent_at: data.sent_at || null,
    status: data.status || 'pending',
  })
}
