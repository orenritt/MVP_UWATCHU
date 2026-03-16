import { NextRequest, NextResponse } from 'next/server'
import { handleInboundSMS } from '@/lib/agent'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const from = formData.get('From') as string
    const body = formData.get('Body') as string

    if (!from || !body) {
      return new NextResponse('Missing From or Body', { status: 400 })
    }

    const replyText = await handleInboundSMS(from, body.trim())

    // Return TwiML response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(replyText)}</Message>
</Response>`

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error) {
    console.error('SMS inbound error:', error)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>UWATCHU: System error. Try again.</Message>
</Response>`
    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
