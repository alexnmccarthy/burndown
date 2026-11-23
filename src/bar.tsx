import type { ElementTable } from 'claude-code'
import type { BurndownHandoff, BurndownMeter, BurndownPlan } from '../types'

import { clip, limitLabel, money, sparkline, untilReset } from './format'
import { isTight } from './meter'
import { summary } from './plan'
import { COBALT, fillFor, meterSvg, sparkSvg } from './svg'

export type BarProps = {
  meter: BurndownMeter
  plan: BurndownPlan
  handoff: BurndownHandoff
  /** Spend of earlier windows in this run, and how many windows so far. */
  run: { priorUsd: number; windows: number }
  columns: number
  isWorking: boolean
  now: number
  onHandoff: () => unknown
  onNextWindow: () => unknown
  onCancel: () => unknown
  onPlan: () => unknown
  onTrack: () => unknown
}

const ctxTone = (pct: number) => (pct >= 85 ? 'error' : pct >= 60 ? 'warning' : undefined)

/**
 * The canvas's bar: "This window $3.10 ▂▃▅ [▓▓░░] 62% context │ Total $17.45",
 * then Handoff and the plan chip on the right. Parts drop as the column narrows.
 */
export function bar(ui: ElementTable, p: BarProps) {
  const { Box, Text, Button } = ui
  const Svg = 'Svg' in ui ? ui.Svg : undefined
  const m = p.meter
  const cols = p.columns
  const wide = cols >= 100
  const mid = cols >= 70

  const usd = m.usd ?? 0
  const pct = m.contextPct
  const s = summary(p.plan)
  const ho = p.handoff
  const showHandoff = ho.stage === 'idle' && isTight(m)

  // The chip: the plan's count and step, or Track when there is none.
  const step = s.isDone ? 'done' : (s.current ?? s.next)?.title
  const chipTitle = step && mid ? ` ${clip(step, wide ? 28 : 18)}` : ''
  const ctxBlocks = pct === undefined ? 0 : Math.min(5, Math.round(pct / 20))

  return (
    <Box flexDirection="row" justifyContent="space-between" alignItems="center" width="100%" gap={2}>
      <Box flexDirection="row" alignItems="center" gap={1} flexShrink={1}>
        {mid && <Text dimColor>This window</Text>}
        {m.usd !== undefined && cols >= 45 && (
          <Text weight="semibold" tabular dimColor={p.isWorking}>
            {m.unknownPrice ? `${money(usd)}?` : money(usd)}
          </Text>
        )}
        {wide && m.turns.length > 1 &&
          (Svg ? (
            <Svg source={sparkSvg(m.turns)} alt={`Cost per turn, last ${money(m.turns[m.turns.length - 1] ?? 0)}`} />
          ) : (
            <Text color={COBALT}>{sparkline(m.turns)}</Text>
          ))}
        {pct !== undefined &&
          (Svg ? (
            <Svg source={meterSvg(pct)} alt={`${Math.round(pct)}% of the context window used`} width={72} height={6} />
          ) : (
            <Text color={fillFor(pct)}>
              {'▓'.repeat(ctxBlocks)}
              {'░'.repeat(5 - ctxBlocks)}
            </Text>
          ))}
        {pct !== undefined && (
          <Text color={ctxTone(pct)} dimColor={!ctxTone(pct)} tabular>
            {`${Math.round(pct)}%${mid ? ' context' : ''}`}
          </Text>
        )}
        {m.limit && (
          <Text dimColor tabular>
            {`│ ${limitLabel(m.limit.kind)} ${Math.round(m.limit.pct)}%`}
            {mid && m.limit.resetsAt !== undefined ? ` · resets in ${untilReset(m.limit.resetsAt, p.now)}` : ''}
          </Text>
        )}
        {wide && p.run.windows > 1 && <Text dimColor>│ Total</Text>}
        {wide && p.run.windows > 1 && (
          <Text weight="semibold" tabular>
            {money(p.run.priorUsd + usd)}
          </Text>
        )}
      </Box>
      <Box flexDirection="row" alignItems="center" gap={1}>
        {showHandoff && <Button key="handoff" label="Handoff" onPress={p.onHandoff} />}
        {ho.stage === 'writing' && <Text dimColor>Writing brief…</Text>}
        {ho.stage === 'ready' && (
          <Button key="next" label="Start next window" variant="primary" onPress={p.onNextWindow} />
        )}
        {ho.stage === 'ready' && <Button key="cancel" label="Not now" onPress={p.onCancel} />}
        {s.total > 0 ? (
          <Button key="plan" onPress={p.onPlan}>
            <Text color={s.isDone ? 'success' : COBALT}>{s.isDone ? '✓' : '●'}</Text>
            {` ${s.done}/${s.total}${chipTitle} ⌄`}
          </Button>
        ) : (
          mid && (
            <Button key="track" onPress={p.onTrack}>
              <Text dimColor>○</Text>
              {' Track'}
            </Button>
          )
        )}
      </Box>
    </Box>
  )
}
