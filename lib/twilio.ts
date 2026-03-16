import twilio from 'twilio'
import { isDevMode, logDevSMS } from './dev'

const accountSid = process.env.TWILIO_ACCOUNT_SID || ''
const authToken = process.env.TWILIO_AUTH_TOKEN || ''
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || ''
const fromNumber = process.env.TWILIO_PHONE_NUMBER || ''

function getClient() {
  return twilio(accountSid, authToken)
}

export async function sendSMS(to: string, body: string): Promise<void> {
  if (isDevMode) {
    logDevSMS({
      from: 'UWATCHU',
      to,
      body,
      direction: 'outbound',
    })
    return
  }

  const opts: { body: string; to: string; messagingServiceSid?: string; from?: string } = {
    body,
    to,
  }

  if (messagingServiceSid) {
    opts.messagingServiceSid = messagingServiceSid
  } else {
    opts.from = fromNumber
  }

  await getClient().messages.create(opts)
}

export function validateTwilioRequest(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (isDevMode) return true
  return twilio.validateRequest(authToken, signature, url, params)
}
