import Stripe from 'stripe'
import { isDevMode } from './dev'
import { supabaseAdmin } from './supabase'

export const stripe = isDevMode
  ? (null as unknown as Stripe)
  : new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder', {
      apiVersion: '2025-02-24.acacia',
    })

export async function getOrCreateStripeCustomer(
  userId: string,
  phoneNumber: string
): Promise<string> {
  if (isDevMode) {
    const devId = `dev_cus_${userId.slice(0, 8)}`
    const { devUpdateUser } = await import('./dev-db')
    devUpdateUser(userId, { stripe_customer_id: devId })
    return devId
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (user?.stripe_customer_id) return user.stripe_customer_id

  const customer = await stripe.customers.create({
    phone: phoneNumber,
    metadata: { user_id: userId },
  })

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
  if (isDevMode) {
    return {
      id: `dev_seti_${crypto.randomUUID().slice(0, 8)}`,
      client_secret: 'dev_secret',
      customer: customerId,
      metadata: { commitment_id: commitmentId, stake_amount: stakeAmount.toString() },
      payment_method: `dev_pm_${crypto.randomUUID().slice(0, 8)}`,
    } as unknown as Stripe.SetupIntent
  }

  return stripe.setupIntents.create({
    customer: customerId,
    usage: 'off_session',
    metadata: {
      commitment_id: commitmentId,
      stake_amount: stakeAmount.toString(),
    },
  })
}

export async function captureStripePayment(commitmentId: string): Promise<void> {
  if (isDevMode) {
    console.log(`[DEV STRIPE] Would capture payment for commitment ${commitmentId}`)
    return
  }

  const { data: commitment } = await supabaseAdmin
    .from('commitments')
    .select('*, user:users(*)')
    .eq('id', commitmentId)
    .single()

  if (!commitment) throw new Error(`Commitment ${commitmentId} not found`)

  const setupIntent = await stripe.setupIntents.retrieve(
    commitment.stripe_setup_intent_id
  )

  if (!setupIntent.payment_method) {
    throw new Error('No payment method found on setup intent')
  }

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
  if (isDevMode) {
    return { clientSecret: 'dev_secret', publishableKey: 'dev_pk' }
  }

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
