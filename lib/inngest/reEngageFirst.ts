import { inngest } from './client'
import { supabaseAdmin, getCommitment } from '../supabase'
import { sendSMS } from '../twilio'
import { calculateReEngagementDays } from '../scheduler'

export const reEngageFirst = inngest.createFunction(
  { id: 're-engage-first' },
  { event: 'commitment/re-engage-first' },
  async ({ event, step }) => {
    const { commitmentId, userId } = event.data

    await step.run('send-re-engage', async () => {
      const commitment = await getCommitment(commitmentId)

      await sendSMS(
        commitment.user.phone_number,
        "UWATCHU: What's next?"
      )

      // Set re-engagement state on user
      const windowCloses = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await supabaseAdmin
        .from('users')
        .update({
          re_engagement_commitment_id: commitmentId,
          re_engagement_touch: 1,
          re_engagement_window_closes_at: windowCloses.toISOString(),
        })
        .eq('id', userId)
    })

    // Schedule second touch if no response
    const commitment = await step.run('fetch', () => getCommitment(commitmentId))
    const durationDays = commitment.starts_at && commitment.ends_at
      ? Math.ceil((new Date(commitment.ends_at).getTime() - new Date(commitment.starts_at).getTime()) / (1000 * 60 * 60 * 24))
      : 28
    const { secondTouch } = calculateReEngagementDays(durationDays)

    await step.sendEvent('schedule-second-touch', {
      name: 'commitment/re-engage-second',
      data: { commitmentId, userId },
      ts: Date.now() + (secondTouch - calculateReEngagementDays(durationDays).firstTouch) * 24 * 60 * 60 * 1000,
    })
  }
)
