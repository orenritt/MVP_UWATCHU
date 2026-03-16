import { notFound } from 'next/navigation'
import { getCommitmentBySlug } from '@/lib/supabase'
import ProofUpload from '@/components/ProofUpload'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ProvePage({ params }: Props) {
  const { slug } = await params
  const commitment = await getCommitmentBySlug(slug)

  if (!commitment) {
    notFound()
  }

  if (commitment.status !== 'active') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <div className="text-[11px] font-mono tracking-[6px] text-[#555]">
            UWATCHU
          </div>
          <div className="font-mono text-[#555] text-sm tracking-wider">
            {commitment.status === 'failed'
              ? 'COMMITMENT FAILED. NO FURTHER SUBMISSIONS.'
              : commitment.status === 'completed'
              ? 'COMMITMENT DISCHARGED.'
              : 'COMMITMENT NOT ACTIVE.'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* Wordmark */}
        <div className="text-[11px] font-mono tracking-[6px] text-[#555]">
          UWATCHU
        </div>

        <ProofUpload
          commitmentId={commitment.id}
          goalDescription={
            commitment.goal_parsed?.description || commitment.goal_text
          }
        />
      </div>
    </div>
  )
}
