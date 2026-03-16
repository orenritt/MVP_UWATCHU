import Stripe from 'stripe'
import { supabaseAdmin } from './supabase'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder', {
  apiVersion: '2025-02-24.acacia',
})

export async function getOrCreateStripeCustomer(
  userId: string,
  phoneNumber: string
): Promise<string> {
  // Check if user already has a Stripe customer ID
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (user?.stripe_customer_id) return user.stripe_customer_id

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    phone: phoneNumber,
    metadata: { user_id: userId },
  })

  // Save customer ID
  await supabaseAdmin
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)

  return customer.id
}

export async function createSetupIntent(
  customerId: string,
  commitmentId: string,
  stakeAmount: number
): Promise<Stripe.SetupIntent> {
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: 'off_session',
    metadata: {
      commitment_id: commitmentId,
      stake_amount: stakeAmount.toString(),
    },
  })

  return setupIntent
}

export async function captureStripePayment(commitmentId: string): Promise<void> {
  const { data: commitment } = await supabaseAdmin
    .from('commitments')
    .select('*, user:users(*)')
    .eq('id', commitmentId)
    .single()

  if (!commitment) throw new Error(`Commitment ${commitmentId} not found`)

  // Get the customer's payment method from the setup intent
  const setupIntent = await stripe.setupIntents.retrieve(
    commitment.stripe_setup_intent_id
  )

  if (!setupIntent.payment_method) {
    throw new Error('No payment method found on setup intent')
  }

  // Create and capture a payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: commitment.stake_amount,
    currency: 'usd',
    customer: commitment.user.stripe_customer_id,
    payment_method: setupIntent.payment_method as string,
    off_session: true,
    confirm: true,
    metadata: {
      commitment_id: commitmentId,
      charity_id: commitment.charity_id,
    },
  })

  await supabaseAdmin
    .from('commitments')
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq('id', commitmentId)
}

export async function getSetupIntentClientSecret(
  commitmentId: string
): Promise<{ clientSecret: string; publishableKey: string }> {
  const { data: commitment } = await supabaseAdmin
    .from('commitments')
    .select('stripe_setup_intent_id')
    .eq('id', commitmentId)
    .single()

  if (!commitment?.stripe_setup_intent_id) {
    throw new Error('No setup intent found for commitment')
  }

  const setupIntent = await stripe.setupIntents.retrieve(
    commitment.stripe_setup_intent_id
  )

  return {
    clientSecret: setupIntent.client_secret!,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
  }
}
