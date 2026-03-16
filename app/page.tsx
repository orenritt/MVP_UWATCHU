import Link from 'next/link'

const isDevMode =
  process.env.NEXT_PUBLIC_DEV_MODE === 'true' ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-6 px-4">
        <h1 className="font-mono text-3xl tracking-[8px] text-[#e8e8e8]">
          UWATCHU
        </h1>
        <div className="font-mono text-sm text-[#555] tracking-wider max-w-md">
          SMS-native accountability with financial stakes.
          Text your commitment. The machine watches. The machine collects.
        </div>
        <div className="font-mono text-xs text-[#333] tracking-wider">
          Text your commitment to get started.
        </div>

        {isDevMode && (
          <div className="pt-8 space-y-3">
            <Link
              href="/dev/sms"
              className="inline-block bg-[#e8e8e8] text-[#0a0a0a] font-mono text-xs font-bold px-8 py-3 tracking-widest hover:bg-white transition-colors"
            >
              OPEN SMS SIMULATOR
            </Link>
            <div className="font-mono text-[10px] text-[#333]">
              Dev mode active — no external services required except Anthropic API
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
