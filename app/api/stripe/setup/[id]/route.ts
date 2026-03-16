import { NextRequest, NextResponse } from 'next/server'
import { getSetupIntentClientSecret } from '@/lib/stripe'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commitmentId } = await params

    const { clientSecret, publishableKey } = await getSetupIntentClientSecret(commitmentId)

    // Return an HTML page with Stripe Elements for card setup
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UWATCHU — Lock In Your Stake</title>
  <script src="https://js.stripe.com/v3/"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a;
      color: #e8e8e8;
      font-family: 'Courier New', monospace;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 400px;
      width: 100%;
    }
    h1 {
      font-size: 14px;
      letter-spacing: 4px;
      color: #555;
      margin-bottom: 32px;
    }
    h2 {
      font-size: 18px;
      margin-bottom: 24px;
      font-weight: normal;
    }
    #payment-element {
      margin-bottom: 24px;
    }
    button {
      width: 100%;
      padding: 14px;
      background: #e8e8e8;
      color: #0a0a0a;
      border: none;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 2px;
      cursor: pointer;
      text-transform: uppercase;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    #error-message {
      color: #ff3b00;
      margin-top: 12px;
      font-size: 12px;
    }
    .success {
      text-align: center;
      color: #00ff41;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>UWATCHU</h1>
    <h2>Add your card to lock in the stake.</h2>
    <div id="payment-element"></div>
    <button id="submit-btn">LOCK IN</button>
    <div id="error-message"></div>
  </div>
  <script>
    const stripe = Stripe('${publishableKey}');
    const elements = stripe.elements({
      clientSecret: '${clientSecret}',
      appearance: {
        theme: 'night',
        variables: {
          colorPrimary: '#e8e8e8',
          colorBackground: '#111111',
          colorText: '#e8e8e8',
          fontFamily: '"Courier New", monospace',
          borderRadius: '0px',
        },
      },
    });
    const paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');

    const btn = document.getElementById('submit-btn');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'PROCESSING...';
      const { error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/api/stripe/setup/${commitmentId}?complete=1',
        },
      });
      if (error) {
        document.getElementById('error-message').textContent = error.message;
        btn.disabled = false;
        btn.textContent = 'LOCK IN';
      }
    });

    // Check if returning from redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('complete') === '1' || urlParams.get('setup_intent')) {
      document.querySelector('.container').innerHTML = '<div class="success"><h2>STAKE LOCKED.</h2><p>The machine is watching.</p></div>';
    }
  </script>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (error) {
    console.error('Setup page error:', error)
    return NextResponse.json({ error: 'Failed to load setup page' }, { status: 500 })
  }
}
