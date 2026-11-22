import { expect, test } from 'claude-code/testing'

import { clip, limitLabel, money, sparkline, untilReset } from '../src/format'
import {
  EMPTY,
  isDesktopPlanTool,
  onDesktopPlan,
  onTaskCreate,
  onTaskUpdate,
  onTodoWrite,
  summary,
} from '../src/plan'

test('money keeps to six cells', async () => {
  const cases: [number, string][] = [
    [0, '≈$0.00'],
    [3.104, '≈$3.10'],
    [17.45, '≈$17'],
    [999.4, '≈$999'],
    [1204.5, '≈$1.2k'],
    [-1, '≈?'],
    [Number.NaN, '≈?'],
  ]
  for (const [usd, want] of cases) {
    expect(money(usd)).toBe(want)
    expect(money(usd).length <= 6).toBe(true)
  }
})

test('untilReset reads at a glance', async () => {
  const now = 1_000_000_000_000
  const cases: [number, string][] = [
    [0, '0m'],
    [40, '40m'],
    [120, '2h'],
    [130, '2h 10m'],
    [24 * 60 * 3 + 240, '3d 4h'],
    [-5, '0m'],
  ]
  for (const [mins, want] of cases) expect(untilReset(now + mins * 60_000, now)).toBe(want)
})

test('labels, sparkline and clip', async () => {
  expect(limitLabel('five_hour')).toBe('5h')
  expect(limitLabel('seven_day')).toBe('7d')
  expect(limitLabel('other')).toBe('other')
  expect(sparkline([])).toBe('')
  expect(sparkline([0, 0])).toBe('▁▁')
  expect(sparkline([1, 2, 4, 8])).toBe('▁▂▄█')
  expect(clip('Wire payment step', 8)).toBe('Wire pa…')
  expect(clip('short', 8)).toBe('short')
})

test('TaskCreate and TaskUpdate build the plan', async () => {
  let plan = onTaskCreate(EMPTY, { task: { id: '1', subject: 'Audit flow' } })
  plan = onTaskCreate(plan, { task: { id: '2', subject: 'Build summary' } })
  plan = onTaskCreate(plan, { task: { id: '2', subject: 'duplicate' } })
  plan = onTaskCreate(plan, { nothing: true })
  expect(plan.steps.length).toBe(2)

  plan = onTaskUpdate(plan, { taskId: '1', status: 'completed' })
  plan = onTaskUpdate(plan, { taskId: '2', status: 'in_progress', subject: 'Build cart summary' })
  expect(summary(plan).done).toBe(1)
  expect(summary(plan).current?.title).toBe('Build cart summary')

  plan = onTaskUpdate(plan, { taskId: '1', status: 'deleted' })
  expect(plan.steps.map(s => s.id)).toEqual(['2'])
})

test('TodoWrite replaces the plan', async () => {
  const plan = onTodoWrite({
    todos: [
      { content: 'A', status: 'completed', activeForm: 'a' },
      { content: 'B', status: 'in_progress', activeForm: 'b' },
      { content: '', status: 'pending', activeForm: '' },
    ],
  })
  expect(plan?.steps.length).toBe(2)
  expect(onTodoWrite({ nope: 1 })).toBe(undefined)
})

test('the desktop task list: whole list, then moves', async () => {
  expect(isDesktopPlanTool('mcp__ccd_turn__update_plan')).toBe(true)
  expect(isDesktopPlanTool('Bash')).toBe(false)

  let plan = onDesktopPlan(EMPTY, {
    items: [
      { content: 'One', status: 'in_progress' },
      { content: 'Two', status: 'pending' },
      { content: 'Three', status: 'pending' },
    ],
  })
  plan = onDesktopPlan(plan, { advance: true })
  expect(plan.steps.map(s => s.status)).toEqual(['completed', 'in_progress', 'pending'])

  plan = onDesktopPlan(plan, { done: [2, 3] })
  expect(summary(plan).isDone).toBe(true)

  plan = onDesktopPlan(plan, { start: 3 })
  expect(summary(plan).current?.title).toBe('Three')
})
