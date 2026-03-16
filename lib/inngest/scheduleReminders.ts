import { inngest } from './client'
import { getCommitment } from '../supabase'
import { buildReminderSchedule } from '../scheduler'

export const scheduleReminders = inngest.createFunction(
  { id: 'schedule-all-reminders' },
  { event: 'commitment/activated' },
  async ({ event, step }) => {
    const { commitmentId } = event.data

    const commitment = await step.run('fetch-commitment', () =>
      getCommitment(commitmentId)
    )

    const reminderDates = buildReminderSchedule(commitment)

    for (const reminder of reminderDates) {
      await step.sendEvent('schedule-reminder', {
        name: 'commitment/send-reminder',
        data: { commitmentId, periodId: reminder.periodId },
        ts: reminder.scheduledFor.getTime(),
      })
    }

    // Schedule final deadline check
    if (commitment.ends_at) {
      await step.sendEvent('schedule-deadline-check', {
        name: 'commitment/check-deadline',
        data: { commitmentId },
        ts: new Date(commitment.ends_at).getTime() + 60_000,
      })
    }
  }
)
