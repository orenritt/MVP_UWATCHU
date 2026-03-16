import { inngest } from './client'
import { supabaseAdmin, getCommitment } from '../supabase'
import { sendSMS } from '../twilio'

export const reEngageSecond = inngest.createFunction(
  { id: 're-engage-second' },
  { event: 'commitment/re-engage-second' },
  async ({ event, step }) => {
    const { commitmentId, userId } = event.data

    // Check if user already responded (re-engagement cleared)
    const user = await step.run('check-user', async () => {
      const { data } = await supabaseAdmin
        .from('users')
        .select('re_engagement_touch')
        .eq('id', userId)
        .single()
      return data
    })

    // If touch is 0 or user already responded, skip
    if (!user || user.re_engagement_touch === 0) return

    const commitment = await step.run('fetch', () => getCommitment(commitmentId))

    await step.run('send-second-touch', async () => {
      await sendSMS(
        commitment.user.phone_number,
        'UWATCHU: Still watching.'
      )

      // Update re-engagement state — close loop after this
      await supabaseAdmin
        .from('users')
        .update({
          re_engagement_touch: 3, // closed
          re_engagement_window_closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', userId)
    })
  }
)
