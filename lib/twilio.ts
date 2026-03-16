import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID || ''
const authToken = process.env.TWILIO_AUTH_TOKEN || ''
const fromNumber = process.env.TWILIO_PHONE_NUMBER || ''

function getClient() {
  return twilio(accountSid, authToken)
}

export async function sendSMS(to: string, body: string): Promise<void> {
  await getClient().messages.create({
    body,
    from: fromNumber,
    to,
  })
}

export function validateTwilioRequest(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  return twilio.validateRequest(authToken, signature, url, params)
}
