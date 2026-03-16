import { inngest } from './client'
import { updateCommitmentStatus } from '../supabase'

export const cancelReminders = inngest.createFunction(
  { id: 'cancel-reminders' },
  { event: 'commitment/cancelled' },
  async ({ event, step }) => {
    const { commitmentId } = event.data

    await step.run('update-status', () =>
      updateCommitmentStatus(commitmentId, 'cancelled')
    )

    // Note: Inngest handles cancellation of scheduled events
    // by checking commitment status in each handler before executing
  }
)
