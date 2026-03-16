import { NextRequest, NextResponse } from 'next/server'
import { getCommitment, getProofsForCommitment, getMissesForCommitment } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const commitment = await getCommitment(id)

    if (!commitment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [proofs, misses] = await Promise.all([
      getProofsForCommitment(id),
      getMissesForCommitment(id),
    ])

    return NextResponse.json({
      commitment: {
        id: commitment.id,
        goal_text: commitment.goal_text,
        goal_parsed: commitment.goal_parsed,
        verification_method: commitment.verification_method,
        cadence: commitment.cadence,
        failure_modes: commitment.failure_modes,
        stake_amount: commitment.stake_amount,
        status: commitment.status,
        is_public: commitment.is_public,
        slug: commitment.slug,
        starts_at: commitment.starts_at,
        ends_at: commitment.ends_at,
        charity: commitment.charity
          ? { name: commitment.charity.name, logo_url: commitment.charity.logo_url }
          : null,
      },
      proofs: proofs.map((p) => ({
        id: p.id,
        submitted_at: p.submitted_at,
        image_url: p.image_url,
        gps_lat: p.gps_lat,
        gps_lng: p.gps_lng,
        status: p.status,
      })),
      misses: misses.map((m) => ({
        missed_date: m.missed_date,
        triggered_failure: m.triggered_failure,
      })),
    })
  } catch (error) {
    console.error('Commitment fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
