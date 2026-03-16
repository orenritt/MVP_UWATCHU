'use client'

interface StatusBadgeProps {
  status: string
  hasMisses?: boolean
}

export default function StatusBadge({ status, hasMisses }: StatusBadgeProps) {
  const displayStatus = hasMisses && status === 'active' ? 'BREACH' : status.toUpperCase()

  const colorMap: Record<string, string> = {
    ACTIVE: 'border-[#555] text-[#555]',
    BREACH: 'border-[#ff3b00] text-[#ff3b00]',
    FAILED: 'border-[#ff3b00] text-[#ff3b00]',
    COMPLETED: 'border-[#00ff41] text-[#00ff41]',
    CANCELLED: 'border-[#555] text-[#555]',
    PENDING_PAYMENT: 'border-[#555] text-[#555]',
  }

  const colorClass = colorMap[displayStatus] || colorMap.ACTIVE

  return (
    <span
      className={`inline-block border px-3 py-1 text-xs tracking-[3px] font-mono ${colorClass}`}
    >
      {displayStatus === 'COMPLETED' ? 'DISCHARGED' : displayStatus}
    </span>
  )
}
