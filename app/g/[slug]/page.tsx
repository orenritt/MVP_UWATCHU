import { notFound } from 'next/navigation'
import { getCommitmentBySlug, getProofsForCommitment, getMissesForCommitment } from '@/lib/supabase'
import GoalPage from '@/components/GoalPage'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function GoalPageRoute({ params }: Props) {
  const { slug } = await params
  const commitment = await getCommitmentBySlug(slug)

  if (!commitment) {
    notFound()
  }

  const [proofs, misses] = await Promise.all([
    getProofsForCommitment(commitment.id),
    getMissesForCommitment(commitment.id),
  ])

  return (
    <GoalPage
      commitment={{
        id: commitment.id,
        goal_text: commitment.goal_text,
        goal_parsed: commitment.goal_parsed,
        stake_amount: commitment.stake_amount,
        status: commitment.status,
        is_public: commitment.is_public,
        slug: commitment.slug,
        starts_at: commitment.starts_at,
        ends_at: commitment.ends_at,
        cadence: commitment.cadence,
        charity: commitment.charity
          ? { name: commitment.charity.name, logo_url: commitment.charity.logo_url }
          : null,
      }}
      proofs={proofs.map((p) => ({
        id: p.id,
        submitted_at: p.submitted_at,
        image_url: p.image_url,
        gps_lat: p.gps_lat,
        gps_lng: p.gps_lng,
        status: p.status,
      }))}
      misses={misses.map((m) => ({
        missed_date: m.missed_date,
        triggered_failure: m.triggered_failure,
      }))}
    />
  )
}
