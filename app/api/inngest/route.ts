import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { scheduleReminders } from '@/lib/inngest/scheduleReminders'
import { sendReminder } from '@/lib/inngest/sendReminder'
import { checkMiss } from '@/lib/inngest/checkMiss'
import { checkDeadline } from '@/lib/inngest/checkDeadline'
import { failCommitment } from '@/lib/inngest/failCommitment'
import { cancelReminders } from '@/lib/inngest/cancelReminders'
import { reEngageFirst } from '@/lib/inngest/reEngageFirst'
import { reEngageSecond } from '@/lib/inngest/reEngageSecond'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    scheduleReminders,
    sendReminder,
    checkMiss,
    checkDeadline,
    failCommitment,
    cancelReminders,
    reEngageFirst,
    reEngageSecond,
  ],
})
