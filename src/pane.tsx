import type { ElementTable } from 'claude-code'
import type { BurndownPlan } from '../types'

import { clip, money } from './format'
import { summary } from './plan'
import { COBALT, meterSvg } from './svg'

export type PaneProps = {
  plan: BurndownPlan
  run: { priorUsd: number; windows: number }
  usd?: number
  /** `widget` is the small corner form, where clicks may not reach: a glance only. */
  placement: string
  columns: number
  onHandoff: () => unknown
}

/** The canvas's plan card: where the plan stands, every step, and the total. */
export function pane(ui: ElementTable, p: PaneProps) {
  const { Box, Text, Button } = ui
  const Svg = 'Svg' in ui ? ui.Svg : undefined
  const s = summary(p.plan)
  const isGlance = p.placement === 'widget'
  const at = s.current ? p.plan.steps.indexOf(s.current) + 1 : s.done
  const pct = s.total ? (s.done / s.total) * 100 : 0
  const room = Math.max(12, p.columns - 4)

  if (s.total === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text weight="semibold">No plan yet</Text>
        <Text dimColor>It appears as soon as Claude makes a task list. Press Track in the bar to ask for one.</Text>
      </Box>
    )
  }

  const progress = Svg ? (
    <Svg source={meterSvg(pct, 280, COBALT)} alt={`${s.done} of ${s.total} steps done`} height={6} />
  ) : (
    <Text color={COBALT}>
      {'▓'.repeat(Math.round(pct / 10))}
      {'░'.repeat(10 - Math.round(pct / 10))}
    </Text>
  )
  const header = (
    <Box flexDirection="row" justifyContent="space-between">
      <Text size="heading" weight="bold">
        Plan
      </Text>
      <Text dimColor tabular>
        {`Window ${p.run.windows} · step ${at} of ${s.total}`}
      </Text>
    </Box>
  )

  if (isGlance) {
    return (
      <Box flexDirection="column" gap={1}>
        {header}
        {progress}
        {s.current && (
          <Text weight="semibold" wrap="truncate-end">
            <Text color={COBALT}>● </Text>
            {s.current.title}
          </Text>
        )}
        {s.next && <Text dimColor wrap="truncate-end">{`  next: ${s.next.title}`}</Text>}
      </Box>
    )
  }

  // Past 20 steps, finished ones fold into one line.
  const steps = p.plan.steps
  const fold = steps.length > 20 ? steps.filter(x => x.status === 'completed').length : 0
  const shown = fold ? steps.filter(x => x.status !== 'completed') : steps
  const total = p.run.priorUsd + (p.usd ?? 0)

  return (
    <Box flexDirection="column" gap={1}>
      {header}
      {progress}
      <Box flexDirection="column">
        {fold > 0 && <Text dimColor>{`✓ ${fold} done`}</Text>}
        {shown.map(x => {
          const isDone = x.status === 'completed'
          const isNow = x.status === 'in_progress'
          const isNext = x === s.next
          return (
            <Box key={x.id} flexDirection="column" paddingY={0}>
              <Text wrap="truncate-end">
                <Text color={isDone ? 'success' : isNow ? COBALT : undefined} dimColor={!isDone && !isNow}>
                  {isDone ? '✓ ' : isNow ? '● ' : '○ '}
                </Text>
                <Text strikethrough={isDone} dimColor={isDone} weight={isNow ? 'semibold' : 'regular'}>
                  {clip(x.title, room)}
                </Text>
              </Text>
              {isNow && <Text color={COBALT} size="caption">{'  In progress'}</Text>}
              {isNext && <Text dimColor size="caption">{'  Up next'}</Text>}
            </Box>
          )
        })}
      </Box>
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text>
          <Text dimColor>Total </Text>
          <Text weight="bold" tabular>
            {money(total)}
          </Text>
          <Text dimColor>{p.run.windows > 1 ? ` over ${p.run.windows} windows` : ''}</Text>
        </Text>
        <Button key="pane-handoff" label="Handoff" onPress={p.onHandoff} />
      </Box>
    </Box>
  )
}
