import type { Metadata } from 'next'
import { IBM_Plex_Sans_Thai } from 'next/font/google'

import './globals.css'

const thai = IBM_Plex_Sans_Thai({
  variable: '--font-thai',
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Manday Estimation | PTT Digital',
  description:
    'ประเมิน Man-day ตาม MD Estimation Standard Matrix และ export ตาม template PTT-PSSR-Online_Manday',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="th" className={`${thai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
