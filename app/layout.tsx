import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'UWATCHU',
  description: 'The machine is watching.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] text-[#e8e8e8] antialiased">
        {children}
      </body>
    </html>
  )
}
