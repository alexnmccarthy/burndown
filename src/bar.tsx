import type { Color, ElementTable } from 'claude-code'
import type { BurndownHandoff, BurndownMeter, BurndownPlan } from '../types'

import { clip, limitLabel, money, sparkline, untilReset } from './format'
import { isTight } from './meter'
import { summary } from './plan'

export type BarProps = {
  meter: BurndownMeter
  plan: BurndownPlan
  handoff: BurndownHandoff
  columns: number
  isWorking: boolean
  now: number
  onHandoff: () => unknown
  onNextWindow: () => unknown
  onCancel: () => unknown
}

const tone = (pct: number): Color | undefined =>
  pct >= 85 ? 'error' : pct >= 60 ? 'warning' : undefined

/**
 * The one row above the prompt. Parts drop out as the column narrows, most
 * useful last: context, then the limit or spend, then the plan, then the sparkline.
 */
export function bar(ui: ElementTable, p: BarProps) {
  const { Box, Text, Button } = ui
  const m = p.meter
  const cols = p.columns
  const parts: { text: string; color?: Color; dim?: boolean }[] = []

  if (m.contextPct !== undefined) {
    parts.push({ text: `ctx ${Math.round(m.contextPct)}%`, color: tone(m.contextPct) })
  }
  if (m.limit) {
    const reset =
      cols >= 70 && m.limit.resetsAt !== undefined ? ` · ${untilReset(m.limit.resetsAt, p.now)}` : ''
    parts.push({
      text: `${limitLabel(m.limit.kind)} ${Math.round(m.limit.pct)}%${reset}`,
      color: tone(m.limit.pct),
    })
  } else if (m.usd !== undefined && m.usd > 0 && cols >= 45) {
    // On a subscription the limits arrive with the first reply; until then show no dollars.
    parts.push({ text: m.unknownPrice ? `${money(m.usd)}?` : money(m.usd), dim: p.isWorking })
  }
  if (cols >= 90 && m.turns.length > 1) parts.push({ text: sparkline(m.turns), dim: true })

  // What the buttons on the right take, so the plan title gets the rest.
  const ho = p.handoff
  const showHandoff = ho.stage === 'idle' && isTight(m)
  const right =
    ho.stage === 'ready' ? 22 + 10 : ho.stage === 'writing' ? 16 : showHandoff ? 12 : 0

  const s = summary(p.plan)
  if (s.total > 0) {
    const used = parts.reduce((n, x) => n + x.text.length + 3, 0) + right
    const count = s.isDone ? `✓ ${s.total}/${s.total}` : `${s.done}/${s.total}`
    const title = s.isDone ? '' : (s.current ?? s.next)?.title ?? ''
    const room = cols - used - count.length - 1
    parts.push({ text: room >= 8 && title ? `${count} ${clip(title, room)}` : count })
  }

  return (
    <Box flexDirection="row" justifyContent="space-between" width="100%">
      <Box flexDirection="row" flexShrink={1}>
        {parts.map((x, n) => (
          <Text key={String(n)} color={x.color} dimColor={x.dim} wrap="truncate-end">
            {n > 0 ? ' · ' : ''}
            {x.text}
          </Text>
        ))}
      </Box>
      <Box flexDirection="row" gap={1}>
        {showHandoff && <Button key="handoff" label="Handoff" onPress={p.onHandoff} />}
        {ho.stage === 'writing' && <Text dimColor>Writing brief…</Text>}
        {ho.stage === 'ready' && (
          <Button key="next" label="Start next window" variant="primary" onPress={p.onNextWindow} />
        )}
        {ho.stage === 'ready' && <Button key="cancel" label="Not now" onPress={p.onCancel} />}
      </Box>
    </Box>
  )
}
