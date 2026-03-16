import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin, updateCommitmentStatus } from '@/lib/supabase'
import { inngest } from '@/lib/inngest/client'
import { sendSMS } from '@/lib/twilio'
import type Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent
        const commitmentId = setupIntent.metadata?.commitment_id

        if (!commitmentId) break

        // Activate the commitment
        await updateCommitmentStatus(commitmentId, 'active')

        // Fire Inngest event to schedule all reminders
        await inngest.send({
          name: 'commitment/activated',
          data: { commitmentId },
        })

        // Notify user
        const { data: commitment } = await supabaseAdmin
          .from('commitments')
          .select('*, user:users(*)')
          .eq('id', commitmentId)
          .single()

        if (commitment) {
          await sendSMS(
            commitment.user.phone_number,
            `UWATCHU: Commitment locked. The machine is watching.`
          )
        }
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const commitmentId = paymentIntent.metadata?.commitment_id

        if (!commitmentId) break

        // Failure payment captured successfully
        await updateCommitmentStatus(commitmentId, 'failed')
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const commitmentId = paymentIntent.metadata?.commitment_id

        if (!commitmentId) break

        console.error(`Payment failed for commitment ${commitmentId}`)

        const { data: commitment } = await supabaseAdmin
          .from('commitments')
          .select('*, user:users(*)')
          .eq('id', commitmentId)
          .single()

        if (commitment) {
          await sendSMS(
            commitment.user.phone_number,
            'UWATCHU: Payment processing failed. Your card will be retried.'
          )
        }
        break
      }
    }
  } catch (error) {
    console.error('Stripe webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
