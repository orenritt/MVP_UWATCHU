'use client'

interface Proof {
  id: string
  submitted_at: string
  image_url: string
  gps_lat: number | null
  gps_lng: number | null
  status: string
}

interface ProofFeedProps {
  proofs: Proof[]
}

export default function ProofFeed({ proofs }: ProofFeedProps) {
  if (proofs.length === 0) {
    return (
      <div className="text-[#555] font-mono text-sm py-8">
        NO PROOFS SUBMITTED
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {proofs.map((proof) => (
        <div
          key={proof.id}
          className={`relative bg-[#111] border ${
            proof.status === 'flagged'
              ? 'border-[#ff3b00]'
              : 'border-[#1f1f1f]'
          }`}
        >
          <div className="aspect-square relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proof.image_url}
              alt="Proof"
              className="w-full h-full object-cover"
            />
            {proof.status === 'flagged' && (
              <div className="absolute top-1 right-1 bg-[#ff3b00] text-[#0a0a0a] text-[9px] px-1.5 py-0.5 font-mono tracking-wider">
                FLAGGED
              </div>
            )}
          </div>
          <div className="p-2 space-y-0.5">
            <div className="text-[10px] text-[#555] font-mono">
              {new Date(proof.submitted_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            {proof.gps_lat && proof.gps_lng && (
              <div className="text-[9px] text-[#333] font-mono">
                {proof.gps_lat.toFixed(4)}, {proof.gps_lng.toFixed(4)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
