'use client'

// Catalog only: each layout primitive holding placeholder content, since layout has no data of its own.
import { useState } from 'react'
import { Ask, AskRow } from '../components/Ask/Ask'
import { Avatar } from '../components/Avatar/Avatar'
import { Button } from '../components/Button/Button'
import { Drawer } from '../components/Drawer/Drawer'
import { Grid } from '../components/Grid/Grid'
import { Heading } from '../components/Heading/Heading'
import { List } from '../components/List/List'
import { Section } from '../components/Section/Section'
import { SplitView } from '../components/SplitView/SplitView'
import { Stack } from '../components/Stack/Stack'
import { Surface } from '../components/Surface/Surface'
import { Tabs } from '../components/Tabs/Tabs'
import { Text } from '../components/Text/Text'
import type { PieceRenderProps } from '../types'

type Demo = PieceRenderProps<Record<string, unknown>>

const Box = ({ label }: { label: string }) => (
  <Surface>
    <Text look="meta">{label}</Text>
  </Surface>
)

export const SurfaceDemo = (_: Demo) => (
  <Surface>
    <Text>A plain card ground for pieces that bring their own insides.</Text>
  </Surface>
)
export const SectionDemo = (_: Demo) => (
  <Section title="Shipping" meta="3 pieces">
    <Box label="a piece" />
    <Box label="another piece" />
  </Section>
)
export const StackDemo = (_: Demo) => (
  <Stack>
    <Box label="first" />
    <Box label="second" />
    <Box label="third" />
  </Stack>
)
export const GridDemo = (_: Demo) => (
  <Grid columns={4}>
    {['one', 'two', 'three', 'four'].map(l => (
      <Box key={l} label={l} />
    ))}
  </Grid>
)
export const SplitViewDemo = (_: Demo) => <SplitView main={<Box label="main" />} side={<Box label="side" />} />
export function DrawerDemo(_: Demo) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open the drawer</Button>
      <Drawer open={open} title="How this was built" sub="release-blockers · 1.9s" onClose={() => setOpen(false)}>
        <Text>The drawer holds the built block, drafts and anything a piece made.</Text>
      </Drawer>
    </>
  )
}
export const TabsDemo = (_: Demo) => (
  <Tabs
    label="Views"
    tabs={[
      { id: 'chart', label: 'Chart', content: <Box label="the chart" /> },
      { id: 'table', label: 'Table', content: <Box label="the table" /> },
    ]}
  />
)
export const HeadingDemo = (_: Demo) => (
  <Stack gap="card">
    <Heading level={1} look="question">
      What&apos;s blocking the next release?
    </Heading>
    <Heading look="section">Every piece the composer can pick</Heading>
    <Heading level={3} look="card-title">
      Milestone pull requests
    </Heading>
  </Stack>
)
export const TextDemo = (_: Demo) => (
  <Stack gap="card">
    <Text look="lead">GitHub is still counting vercel/next.js.</Text>
    <Text>Body text for anything longer than a label.</Text>
    <Text look="hint">A hint under a field.</Text>
    <Text look="meta">meta · interpuncts between facts</Text>
  </Stack>
)
export const ListDemo = (_: Demo) => (
  <Surface>
    <List
      items={[
        { id: '1', title: 'Read the contributing guide', meta: 'CONTRIBUTING.md' },
        { id: '2', title: 'Pick a good first issue', meta: '12 open' },
      ]}
    />
  </Surface>
)
export const AvatarDemo = (_: Demo) => (
  <Stack gap="row">
    {['mira-dev', 'tkato', 'j-oduya'].map(h => (
      <Text key={h}>
        <Avatar handle={h} /> {h}
      </Text>
    ))}
  </Stack>
)
export const ButtonDemo = (_: Demo) => (
  <Stack gap="row">
    <Button variant="primary">Nudge reviewers</Button>
    <Button href="https://github.com/vercel/next.js">Open on GitHub</Button>
  </Stack>
)
export const AskDemo = ({ onAsk }: Demo) => (
  <AskRow
    selected="What's blocking the next release?"
    onAsk={onAsk}
    asks={[
      { label: "What's blocking the next release?", ask: "What's blocking the next release?" },
      { label: 'Is CI getting slower?', ask: 'Is CI getting slower?' },
      { label: 'Who carries this repo?', ask: 'Who carries this repo?' },
    ]}
  />
)
export { Ask }
