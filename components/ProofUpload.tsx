'use client'

import { useState, useRef } from 'react'

interface ProofUploadProps {
  commitmentId: string
  goalDescription: string
}

export default function ProofUpload({ commitmentId, goalDescription }: ProofUploadProps) {
  const [status, setStatus] = useState<'idle' | 'capturing' | 'uploading' | 'success' | 'error'>('idle')
  const [gpsStatus, setGpsStatus] = useState<string>('pending')
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const gpsRef = useRef<{ lat: number; lng: number } | null>(null)

  // Request GPS on mount-like behavior
  useState(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          gpsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setGpsStatus('captured')
        },
        () => {
          setGpsStatus('denied')
        }
      )
    }
  })

  async function handleCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setStatus('uploading')
    const browserTimestamp = new Date().toISOString()

    const formData = new FormData()
    formData.append('commitment_id', commitmentId)
    formData.append('image', file)
    formData.append('browser_timestamp', browserTimestamp)
    if (gpsRef.current) {
      formData.append('gps_lat', gpsRef.current.lat.toString())
      formData.append('gps_lng', gpsRef.current.lng.toString())
    }

    try {
      const res = await fetch('/api/proofs/submit', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Submission failed')
      }

      const data = await res.json()
      if (data.flagged) {
        setStatus('error')
        setErrorMsg('Proof flagged as possible duplicate. Resubmit with a new photo.')
      } else {
        setStatus('success')
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-12">
        <div className="text-[#00ff41] font-mono text-lg tracking-wider mb-4">
          PROOF RECEIVED.
        </div>
        <div className="text-[#555] font-mono text-sm">
          The machine has recorded your submission.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-[#555] font-mono text-sm uppercase tracking-wider">
        {goalDescription}
      </div>

      <div className="text-center">
        <h2 className="font-mono text-lg tracking-[4px] text-[#e8e8e8] mb-8">
          SUBMIT PROOF
        </h2>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCapture}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={status === 'uploading'}
          className="w-full max-w-xs mx-auto block border border-[#e8e8e8] bg-transparent text-[#e8e8e8] font-mono text-sm tracking-[3px] py-4 px-8 hover:bg-[#e8e8e8] hover:text-[#0a0a0a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'uploading' ? 'UPLOADING...' : 'OPEN CAMERA'}
        </button>
      </div>

      <div className="text-center space-y-2">
        <div className="text-[10px] font-mono text-[#555]">
          TIMESTAMP: {new Date().toLocaleString()}
        </div>
        <div className="text-[10px] font-mono text-[#555]">
          LOCATION: {gpsStatus === 'captured' ? 'CAPTURED' : gpsStatus === 'denied' ? 'DENIED' : 'PENDING'}
        </div>
      </div>

      {status === 'error' && (
        <div className="text-[#ff3b00] font-mono text-xs text-center">
          {errorMsg}
        </div>
      )}
    </div>
  )
}
