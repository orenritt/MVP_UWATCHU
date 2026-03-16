import { NextRequest, NextResponse } from 'next/server'
import { isDevMode, devSmsLog, logDevSMS } from '@/lib/dev'
import { handleInboundSMS } from '@/lib/agent'

// GET: poll for all SMS messages
export async function GET() {
  if (!isDevMode) {
    return NextResponse.json({ error: 'Dev mode only' }, { status: 403 })
  }

  return NextResponse.json({ messages: devSmsLog })
}

// POST: simulate sending an SMS from the user's phone
export async function POST(request: NextRequest) {
  if (!isDevMode) {
    return NextResponse.json({ error: 'Dev mode only' }, { status: 403 })
  }

  const { from, body } = await request.json()

  if (!from || !body) {
    return NextResponse.json({ error: 'Missing from or body' }, { status: 400 })
  }

  // Log inbound
  logDevSMS({ from, to: 'UWATCHU', body, direction: 'inbound' })

  // Process through the real agent pipeline
  const reply = await handleInboundSMS(from, body.trim())

  // The reply is also logged as outbound by sendSMS in dev mode,
  // but the TwiML reply from the inbound route won't go through sendSMS.
  // Log it here to make sure the simulator sees it.
  logDevSMS({ from: 'UWATCHU', to: from, body: reply, direction: 'outbound' })

  return NextResponse.json({ reply, messages: devSmsLog })
}
