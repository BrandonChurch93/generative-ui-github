import type { ReactNode } from 'react'
import { Frame } from '../../shell/Frame'

export const metadata = { title: 'Components · Generative UI for GitHub Repos' }

export default function ComponentsLayout({ children }: { children: ReactNode }) {
  return <Frame current="components">{children}</Frame>
}
