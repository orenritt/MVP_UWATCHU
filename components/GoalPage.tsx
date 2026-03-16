'use client'

import StatusBadge from './StatusBadge'
import Countdown from './Countdown'
import ProofFeed from './ProofFeed'

interface GoalPageProps {
  commitment: {
    id: string
    goal_text: string
    goal_parsed: {
      type: string
      description: string
      verification_method: string
      proof_instructions: string
    } | null
    stake_amount: number
    status: string
    is_public: boolean
    slug: string | null
    starts_at: string | null
    ends_at: string | null
    cadence: {
      type: string
      days?: string[]
      reminder_time: string
      proof_deadline_time: string
      allowed_misses: number
    }
    charity: {
      name: string
      logo_url: string | null
    } | null
  }
  proofs: Array<{
    id: string
    submitted_at: string
    image_url: string
    gps_lat: number | null
    gps_lng: number | null
    status: string
  }>
  misses: Array<{
    missed_date: string
    triggered_failure: boolean
  }>
}

export default function GoalPage({ commitment, proofs, misses }: GoalPageProps) {
  const totalExpectedProofs = estimateTotalProofs(commitment)
  const completedProofs = proofs.filter(
    (p) => p.status === 'submitted' || p.status === 'approved'
  ).length
  const progressPercent = totalExpectedProofs > 0
    ? Math.min(100, (completedProofs / totalExpectedProofs) * 100)
    : 0

  const isFailed = commitment.status === 'failed'
  const isCompleted = commitment.status === 'completed'

  return (
    <div className={`min-h-screen bg-[#0a0a0a] ${isFailed ? 'opacity-60' : ''}`}>
      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* Wordmark */}
        <div className="text-[11px] font-mono tracking-[6px] text-[#555]">
          UWATCHU
        </div>

        {/* Status */}
        <StatusBadge status={commitment.status} hasMisses={misses.length > 0} />

        {/* Goal */}
        <h1 className="font-mono text-2xl tracking-wider text-[#e8e8e8] uppercase leading-tight">
          {commitment.goal_parsed?.description || commitment.goal_text}
        </h1>

        {/* Countdown */}
        {commitment.ends_at && (
          <Countdown endsAt={commitment.ends_at} status={commitment.status} />
        )}

        {/* Stake line */}
        {commitment.charity && (
          <div className="font-mono text-sm text-[#ff3b00] tracking-wider">
            ${commitment.stake_amount / 100} → {commitment.charity.name.toUpperCase()} ON FAILURE
          </div>
        )}

        {/* Failure state */}
        {isFailed && (
          <div className="border border-[#ff3b00] p-6 text-center space-y-2">
            <div className="font-mono text-[#ff3b00] text-lg tracking-wider">
              COMMITMENT FAILED.
            </div>
            <div className="font-mono text-[#ff3b00] text-sm">
              ${commitment.stake_amount / 100} TRANSFERRED TO {commitment.charity?.name.toUpperCase()}.
            </div>
          </div>
        )}

        {/* Completed state */}
        {isCompleted && (
          <div className="border border-[#00ff41] p-6 text-center">
            <div className="font-mono text-[#00ff41] text-lg tracking-wider">
              COMMITMENT DISCHARGED.
            </div>
          </div>
        )}

        {/* Progress bar */}
        {!isFailed && !isCompleted && (
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-mono text-[#555] tracking-wider">
              <span>{completedProofs} OF {totalExpectedProofs} PROOFS SUBMITTED</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-1 bg-[#1f1f1f] w-full">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: progressPercent > 75 ? '#00ff41' : progressPercent > 50 ? '#e8e8e8' : '#ff3b00',
                }}
              />
            </div>
          </div>
        )}

        {/* Proof feed */}
        <div className="space-y-3">
          <div className="text-[10px] font-mono text-[#555] tracking-[3px]">
            EVIDENCE LOG
          </div>
          <ProofFeed proofs={proofs} />
        </div>

        {/* Footer */}
        {commitment.is_public && commitment.slug && (
          <div className="pt-8 border-t border-[#1f1f1f]">
            <div className="text-[10px] font-mono text-[#333]">
              uwatchu.com/g/{commitment.slug}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function estimateTotalProofs(commitment: GoalPageProps['commitment']): number {
  if (!commitment.starts_at || !commitment.ends_at) return 0
  const start = new Date(commitment.starts_at)
  const end = new Date(commitment.ends_at)
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  switch (commitment.cadence.type) {
    case 'daily':
    case 'abstinence':
      return days
    case 'frequency':
      return Math.ceil(days / 7) * (commitment.cadence.days?.length || 3)
    case 'deadline':
      return Math.ceil(days / 7) + 1
    default:
      return days
  }
}
