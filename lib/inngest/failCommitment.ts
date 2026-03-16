import { inngest } from './client'
import { getCommitment, updateCommitmentStatus } from '../supabase'
import { captureStripePayment } from '../stripe'
import { sendSMS } from '../twilio'
import { calculateReEngagementDays } from '../scheduler'

export const failCommitment = inngest.createFunction(
  { id: 'fail-commitment' },
  { event: 'commitment/fail' },
  async ({ event, step }) => {
    const { commitmentId, reason } = event.data

    const commitment = await step.run('fetch', () =>
      getCommitment(commitmentId)
    )

    // Don't double-fail
    if (commitment.status === 'failed') return

    await step.run('charge-stripe', () =>
      captureStripePayment(commitmentId)
    )

    await step.run('update-status', () =>
      updateCommitmentStatus(commitmentId, 'failed')
    )

    await step.run('notify-user', () =>
      sendSMS(
        commitment.user.phone_number,
        `UWATCHU: Commitment failed. $${commitment.stake_amount / 100} transferred to ${commitment.charity?.name || 'charity'}. No appeal.`
      )
    )

    // Schedule re-engagement
    const durationDays = commitment.starts_at && commitment.ends_at
      ? Math.ceil((new Date(commitment.ends_at).getTime() - new Date(commitment.starts_at).getTime()) / (1000 * 60 * 60 * 24))
      : 28
    const { firstTouch } = calculateReEngagementDays(durationDays)

    await step.sendEvent('schedule-re-engage', {
      name: 'commitment/re-engage-first',
      data: { commitmentId, userId: commitment.user_id },
      ts: Date.now() + firstTouch * 24 * 60 * 60 * 1000,
    })
  }
)
