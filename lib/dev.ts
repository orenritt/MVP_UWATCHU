/**
 * Dev mode: enables running the full app without any external services.
 * Activated when NEXT_PUBLIC_DEV_MODE=true or when Supabase URL is not set.
 */

export const isDevMode =
  process.env.NEXT_PUBLIC_DEV_MODE === 'true' ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL

// In-memory SMS log for the simulator
export interface DevSMS {
  id: string
  from: string
  to: string
  body: string
  timestamp: string
  direction: 'inbound' | 'outbound'
}

// Global in-memory store (persists across hot reloads in dev via globalThis)
const globalForDev = globalThis as unknown as {
  __devSmsLog?: DevSMS[]
}

if (!globalForDev.__devSmsLog) {
  globalForDev.__devSmsLog = []
}

export const devSmsLog = globalForDev.__devSmsLog

export function logDevSMS(sms: Omit<DevSMS, 'id' | 'timestamp'>): void {
  const entry: DevSMS = {
    ...sms,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  devSmsLog.push(entry)
  const arrow = sms.direction === 'inbound' ? '>>' : '<<'
  console.log(`[DEV SMS] ${sms.from} ${arrow} ${sms.to}: ${sms.body}`)
}
