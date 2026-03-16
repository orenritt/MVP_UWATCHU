import { inngest } from './client'
import { wasProofSubmitted, recordMiss } from '../supabase'

export const checkMiss = inngest.createFunction(
  { id: 'check-miss' },
  { event: 'commitment/check-miss' },
  async ({ event, step }) => {
    const { commitmentId, periodId } = event.data

    const proofSubmitted = await step.run('check-proof', () =>
      wasProofSubmitted(commitmentId, periodId)
    )

    if (proofSubmitted) return

    const miss = await step.run('record-miss', () =>
      recordMiss(commitmentId, periodId)
    )

    if (miss.triggersFailure) {
      await step.sendEvent('trigger-failure', {
        name: 'commitment/fail',
        data: { commitmentId, reason: 'missed_proofs' },
      })
    }
  }
)
