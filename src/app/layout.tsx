import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter, Outfit } from 'next/font/google'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import '@astryxdesign/theme-neutral/theme.css'
import './globals.css'
import { Providers } from './providers'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })
const outfit = Outfit({ variable: '--font-outfit', subsets: ['latin'] })

export const metadata: Metadata = { title: 'TallyOne Ai | AI-Powered Tally Accounting Workspace', description: 'Unified local and cloud server integration, MIS reports, email triggers, and AI financial insights for Tally.' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${outfit.variable}`} suppressHydrationWarning><body><Providers>{children}</Providers></body></html>
}
