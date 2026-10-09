import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import { CursorWarmth } from '@genui-github/ui/shell'
import '../../../../design-system/tokens.css'
import '@genui-github/ui/styles.css'
import './globals.css'

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-loaded-sans',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-loaded-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Generative UI for GitHub Repos',
  description: 'Paste a public GitHub repo, ask it a question, and an agent composes an interface around its data.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <CursorWarmth />
        <div className="page-root">{children}</div>
      </body>
    </html>
  )
}
