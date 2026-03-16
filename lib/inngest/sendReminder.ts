import { inngest } from './client'
import { getCommitment } from '../supabase'
import { sendSMS } from '../twilio'
import { getProofDeadline, daysRemaining } from '../scheduler'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://uwatchu.com'

export const sendReminder = inngest.createFunction(
  { id: 'send-reminder' },
  { event: 'commitment/send-reminder' },
  async ({ event, step }) => {
    const { commitmentId, periodId } = event.data

    const commitment = await step.run('fetch-commitment', () =>
      getCommitment(commitmentId)
    )

    if (['failed', 'completed', 'cancelled'].includes(commitment.status)) return

    await step.run('send-sms', () =>
      sendSMS(
        commitment.user.phone_number,
        `UWATCHU: Time to prove it.\n${commitment.goal_parsed?.description || commitment.goal_text}\nSubmit: ${BASE_URL}/g/${commitment.slug}/prove\n${daysRemaining(commitment)} days remaining.`
      )
    )

    // Schedule miss check at proof deadline
    const proofDeadline = getProofDeadline(commitment, periodId)
    await step.sendEvent('schedule-miss-check', {
      name: 'commitment/check-miss',
      data: { commitmentId, periodId },
      ts: proofDeadline.getTime() + 60_000,
    })
  }
)
