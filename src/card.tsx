import type { ElementTable } from 'claude-code'
import type { BurndownPlan } from '../types'

import { clip, money } from './format'
import { summary } from './plan'
import { COBALT, meterSvg } from './svg'

export type CardProps = {
  plan: BurndownPlan
  run: { priorUsd: number; windows: number }
  usd?: number
  /** `e.surface`: the terminal draws no Svg. */
  surface: string
  columns: number
  /** The most step rows that fit above the bar; past it, finished steps fold first, then the far end. */
  maxSteps: number
  /** No brief is being written or waiting: Handoff may start one. */
  canHandoff: boolean
  onHandoff: () => unknown
}

/** The canvas's plan card, drawn in the band above the bar: where the plan stands, its steps, and the total. */
export function card(ui: ElementTable, p: CardProps) {
  const { Box, Text, Button } = ui
  // The terminal is the one surface without Svg; its table still answers 'Svg' in ui.
  const Svg = p.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : undefined
  const s = summary(p.plan)
  const at = s.current ? p.plan.steps.indexOf(s.current) + 1 : s.done
  const pct = s.total ? (s.done / s.total) * 100 : 0
  const width = Math.max(12, p.columns - 4)

  const progress = Svg ? (
    <Svg source={meterSvg(pct, 280, COBALT)} alt={`${s.done} of ${s.total} steps done`} height={6} />
  ) : (
    <Text color={COBALT}>
      {'▓'.repeat(Math.round(pct / 10))}
      {'░'.repeat(10 - Math.round(pct / 10))}
    </Text>
  )

  // Past maxSteps rows, finished steps fold into one line, then the far end reads "N more".
  const steps = p.plan.steps
  const fold = steps.length > p.maxSteps ? steps.filter(x => x.status === 'completed').length : 0
  const open = fold ? steps.filter(x => x.status !== 'completed') : steps
  const room = p.maxSteps - (fold ? 1 : 0)
  const shown = open.length <= room ? open : open.slice(0, Math.max(1, room - 1))
  const total = p.run.priorUsd + (p.usd ?? 0)

  return (
    <Box flexDirection="column" gap={1} paddingBottom={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <Text weight="bold">Plan</Text>
        <Text dimColor tabular>
          {`Window ${p.run.windows} · step ${at} of ${s.total}`}
        </Text>
      </Box>
      {progress}
      <Box flexDirection="column">
        {fold > 0 && <Text dimColor>{`✓ ${fold} done`}</Text>}
        {shown.map(x => {
          const isDone = x.status === 'completed'
          const isNow = x.status === 'in_progress'
          return (
            <Text key={x.id} wrap="truncate-end">
              <Text color={isDone ? 'success' : isNow ? COBALT : undefined} dimColor={!isDone && !isNow}>
                {isDone ? '✓ ' : isNow ? '● ' : '○ '}
              </Text>
              <Text strikethrough={isDone} dimColor={isDone} weight={isNow ? 'semibold' : 'regular'}>
                {clip(x.title, width)}
              </Text>
              {isNow && <Text color={COBALT}>{'  In progress'}</Text>}
              {x === s.next && <Text dimColor>{'  Up next'}</Text>}
            </Text>
          )
        })}
        {open.length > shown.length && <Text dimColor>{`○ ${open.length - shown.length} more`}</Text>}
      </Box>
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text>
          <Text dimColor>Total </Text>
          <Text weight="bold" tabular>
            {money(total)}
          </Text>
          <Text dimColor>{p.run.windows > 1 ? ` over ${p.run.windows} windows` : ''}</Text>
        </Text>
        {p.canHandoff && <Button key="pane-handoff" label="Handoff" onPress={p.onHandoff} />}
      </Box>
    </Box>
  )
}
