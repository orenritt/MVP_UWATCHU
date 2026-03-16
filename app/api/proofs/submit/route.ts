import { NextRequest, NextResponse } from 'next/server'
import { isDevMode } from '@/lib/dev'
import { supabaseAdmin, getCommitment } from '@/lib/supabase'
import { devInsertProof, devGetProofsForCommitment } from '@/lib/dev-db'
import {
  generatePerceptualHash,
  checkForDuplicate,
  uploadProofImage,
} from '@/lib/proof-validation'
import { sendSMS } from '@/lib/twilio'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const commitmentId = formData.get('commitment_id') as string
    const image = formData.get('image') as File
    const browserTimestamp = formData.get('browser_timestamp') as string
    const gpsLat = formData.get('gps_lat') as string
    const gpsLng = formData.get('gps_lng') as string

    if (!commitmentId || !image) {
      return NextResponse.json(
        { error: 'Missing commitment_id or image' },
        { status: 400 }
      )
    }

    const commitment = await getCommitment(commitmentId)
    if (!commitment) {
      return NextResponse.json(
        { error: 'Commitment not found' },
        { status: 404 }
      )
    }

    if (commitment.status !== 'active') {
      return NextResponse.json(
        { error: 'Commitment is not active' },
        { status: 400 }
      )
    }

    const arrayBuffer = await image.arrayBuffer()
    const imageBuffer = Buffer.from(arrayBuffer)

    const proofId = crypto.randomUUID()
    const now = new Date()
    const periodId = `manual-${now.toISOString().split('T')[0]}`

    if (isDevMode) {
      // In dev mode: skip Supabase storage, generate hash but use local image URL
      const hash = await generatePerceptualHash(imageBuffer)

      devInsertProof({
        id: proofId,
        commitment_id: commitmentId,
        period_id: periodId,
        submitted_at: now.toISOString(),
        image_url: `/dev/proof-placeholder.png`,
        gps_lat: gpsLat ? parseFloat(gpsLat) : null,
        gps_lng: gpsLng ? parseFloat(gpsLng) : null,
        browser_timestamp: browserTimestamp || null,
        perceptual_hash: hash,
        status: 'submitted',
        flagged_reason: null,
      })

      const proofs = devGetProofsForCommitment(commitmentId)
      await sendSMS(
        commitment.user.phone_number,
        `UWATCHU: Proof received. ${proofs.length} submitted so far.`
      )

      return NextResponse.json({ success: true, proof_id: proofId, flagged: false })
    }

    // Production path
    const hash = await generatePerceptualHash(imageBuffer)
    const { isDuplicate, matchedProofId } = await checkForDuplicate(commitmentId, hash)
    const imageUrl = await uploadProofImage(commitmentId, proofId, imageBuffer, image.type)

    const proofData = {
      id: proofId,
      commitment_id: commitmentId,
      period_id: periodId,
      submitted_at: now.toISOString(),
      image_url: imageUrl,
      gps_lat: gpsLat ? parseFloat(gpsLat) : null,
      gps_lng: gpsLng ? parseFloat(gpsLng) : null,
      browser_timestamp: browserTimestamp || null,
      perceptual_hash: hash,
      status: isDuplicate ? 'flagged' : 'submitted',
      flagged_reason: isDuplicate
        ? `Possible duplicate of proof ${matchedProofId}`
        : null,
    }

    await supabaseAdmin.from('proofs').insert(proofData)

    const { count: proofCount } = await supabaseAdmin
      .from('proofs')
      .select('*', { count: 'exact', head: true })
      .eq('commitment_id', commitmentId)
      .in('status', ['submitted', 'approved'])

    const { count: totalSlots } = await supabaseAdmin
      .from('reminders')
      .select('*', { count: 'exact', head: true })
      .eq('commitment_id', commitmentId)

    if (isDuplicate) {
      await sendSMS(
        commitment.user.phone_number,
        'UWATCHU: Proof flagged as possible duplicate. Resubmit.'
      )
    } else {
      await sendSMS(
        commitment.user.phone_number,
        `UWATCHU: Proof received. ${proofCount || 0} of ${totalSlots || '?'} complete.`
      )
    }

    return NextResponse.json({
      success: true,
      proof_id: proofId,
      flagged: isDuplicate,
    })
  } catch (error) {
    console.error('Proof submission error:', error)
    return NextResponse.json(
      { error: 'Failed to process proof' },
      { status: 500 }
    )
  }
}
