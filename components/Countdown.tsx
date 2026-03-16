'use client'

import { useEffect, useState } from 'react'

interface CountdownProps {
  endsAt: string
  status: string
}

export default function Countdown({ endsAt, status }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    function update() {
      const now = new Date().getTime()
      const end = new Date(endsAt).getTime()
      const diff = end - now

      if (diff <= 0) {
        setTimeLeft('EXPIRED')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      setTimeLeft(`${days} DAYS ${String(hours).padStart(2, '0')} HRS ${String(minutes).padStart(2, '0')} MIN REMAINING`)
    }

    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [endsAt])

  if (status === 'failed' || status === 'completed') return null

  return (
    <div className="font-mono text-xl tracking-wider text-[#e8e8e8]">
      {timeLeft}
    </div>
  )
}
