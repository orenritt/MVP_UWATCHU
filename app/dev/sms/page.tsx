'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string
  from: string
  to: string
  body: string
  timestamp: string
  direction: 'inbound' | 'outbound'
}

const DEFAULT_PHONE = '+15551234567'

export default function SMSSimulator() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [phone, setPhone] = useState(DEFAULT_PHONE)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Filter messages for the current phone number
  const myMessages = messages.filter(
    (m) => m.from === phone || m.to === phone
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [myMessages.length])

  async function send() {
    if (!input.trim() || sending) return
    setSending(true)

    try {
      const res = await fetch('/api/dev/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: phone, body: input.trim() }),
      })

      const data = await res.json()

      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (err) {
      console.error('Send failed:', err)
    }

    setInput('')
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center p-4">
      {/* Header */}
      <div className="w-full max-w-lg space-y-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[11px] tracking-[6px] text-[#555]">
            UWATCHU
          </div>
          <div className="font-mono text-[10px] text-[#333]">
            SMS SIMULATOR
          </div>
        </div>

        {/* Phone number selector */}
        <div className="flex gap-2 items-center">
          <label className="font-mono text-[10px] text-[#555] tracking-wider">
            YOUR NUMBER:
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="bg-[#111] border border-[#222] text-[#e8e8e8] font-mono text-xs px-3 py-1.5 flex-1 outline-none focus:border-[#444]"
          />
        </div>
      </div>

      {/* Messages area */}
      <div className="w-full max-w-lg flex-1 overflow-y-auto border border-[#1a1a1a] bg-[#050505] mb-4" style={{ minHeight: '400px', maxHeight: '60vh' }}>
        <div className="p-4 space-y-3">
          {myMessages.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <div className="font-mono text-[#333] text-sm">
                No messages yet.
              </div>
              <div className="font-mono text-[#222] text-xs">
                Text your commitment to start. Try: &quot;I want to run every day&quot;
              </div>
            </div>
          )}

          {myMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === 'inbound' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-3 py-2 font-mono text-xs leading-relaxed ${
                  msg.direction === 'inbound'
                    ? 'bg-[#1a3a1a] text-[#7fcc7f] border border-[#2a4a2a]'
                    : 'bg-[#1a1a1a] text-[#999] border border-[#252525]'
                }`}
              >
                <div className="text-[9px] text-[#444] mb-1">
                  {msg.direction === 'inbound' ? 'YOU' : 'UWATCHU'}{' '}
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
                <div className="whitespace-pre-wrap">{msg.body}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="w-full max-w-lg flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type your message..."
          disabled={sending}
          className="flex-1 bg-[#111] border border-[#222] text-[#e8e8e8] font-mono text-sm px-4 py-3 outline-none focus:border-[#444] disabled:opacity-50 placeholder:text-[#333]"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="bg-[#e8e8e8] text-[#0a0a0a] font-mono text-xs font-bold px-6 py-3 tracking-widest disabled:opacity-30 hover:bg-white transition-colors"
        >
          {sending ? '...' : 'SEND'}
        </button>
      </div>

      {/* Helper text */}
      <div className="w-full max-w-lg mt-4 font-mono text-[10px] text-[#333] space-y-1">
        <div>In dev mode: Stripe skipped (auto-activates), Twilio stubbed (logged to console), Supabase in-memory.</div>
        <div>The Anthropic API key is still required for the AI agent to work. Set ANTHROPIC_API_KEY in .env.local.</div>
      </div>
    </div>
  )
}
