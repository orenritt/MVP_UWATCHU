import { inngest } from './client'
import { getCommitment } from '../supabase'

export const checkDeadline = inngest.createFunction(
  { id: 'check-deadline' },
  { event: 'commitment/check-deadline' },
  async ({ event, step }) => {
    const { commitmentId } = event.data

    const commitment = await step.run('fetch', () =>
      getCommitment(commitmentId)
    )

    if (commitment.status === 'completed') return

    await step.sendEvent('fail', {
      name: 'commitment/fail',
      data: { commitmentId, reason: 'deadline_expired' },
    })
  }
)
