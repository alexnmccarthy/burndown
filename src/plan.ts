/**
 * The plan, read from whichever task tool the session uses. Burndown never asks
 * Claude to keep a list of its own: it mirrors the one Claude already keeps.
 *
 * Three sources, one shape:
 * - TaskCreate / TaskUpdate (the terminal and VS Code)
 * - TodoWrite (older builds and some SDK hosts)
 * - the desktop app's task list tool (`mcp__ccd_turn__update_plan`)
 */

import type { BurndownPlan, BurndownStep } from '../types'

export type Plan = BurndownPlan
export type Step = BurndownStep
export type StepStatus = Step['status']

export const EMPTY: Plan = { steps: [] }

/** The desktop app's task list tool, matched by suffix so a renamed server still reads. */
export const isDesktopPlanTool = (tool: string): boolean =>
  tool.endsWith('__update_plan')

const STATUSES: readonly StepStatus[] = ['pending', 'in_progress', 'completed']
const asStatus = (s: unknown): StepStatus | undefined =>
  STATUSES.find(x => x === s)

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {})
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined

/** A TaskCreate result adds a step. */
export function onTaskCreate(plan: Plan, result: unknown): Plan {
  const task = obj(obj(result).task)
  const id = str(task.id)
  const title = str(task.subject)
  if (!id || !title || plan.steps.some(s => s.id === id)) return plan
  return { steps: [...plan.steps, { id, title, status: 'pending' }] }
}

/** A TaskUpdate input changes a step's status or title, or deletes it. */
export function onTaskUpdate(plan: Plan, input: unknown): Plan {
  const i = obj(input)
  const id = str(i.taskId)
  if (!id) return plan
  if (i.status === 'deleted') return { steps: plan.steps.filter(s => s.id !== id) }
  const status = asStatus(i.status)
  const title = str(i.subject)
  return {
    steps: plan.steps.map(s =>
      s.id === id ? { ...s, status: status ?? s.status, title: title ?? s.title } : s,
    ),
  }
}

/** A TodoWrite input is the whole list each time. */
export function onTodoWrite(input: unknown): Plan | undefined {
  const todos = obj(input).todos
  if (!Array.isArray(todos)) return undefined
  const steps: Step[] = []
  todos.forEach((t, n) => {
    const title = str(obj(t).content)
    const status = asStatus(obj(t).status)
    if (title && status) steps.push({ id: String(n), title, status })
  })
  return { steps }
}

/**
 * The desktop tool sends either the whole list (`items`) or a move
 * (`advance`, `done`, `start`, 1-based).
 */
export function onDesktopPlan(plan: Plan, input: unknown): Plan {
  const i = obj(input)
  if (Array.isArray(i.items)) {
    const steps: Step[] = []
    i.items.forEach((t, n) => {
      const title = str(obj(t).content)
      const status = asStatus(obj(t).status)
      if (title && status) steps.push({ id: String(n), title, status })
    })
    return { steps }
  }
  let steps = plan.steps.map(s => ({ ...s }))
  const set = (n: number, status: StepStatus) => {
    const step = steps[n - 1]
    if (step) step.status = status
  }
  if (Array.isArray(i.done)) for (const n of i.done) if (typeof n === 'number') set(n, 'completed')
  if (typeof i.start === 'number') set(i.start, 'in_progress')
  if (i.advance === true) {
    const cur = steps.findIndex(s => s.status === 'in_progress')
    if (cur >= 0) {
      steps[cur]!.status = 'completed'
      const next = steps.findIndex((s, n) => n > cur && s.status === 'pending')
      if (next >= 0) steps[next]!.status = 'in_progress'
    }
  }
  return { steps }
}

/** What the bar and the pane need from a plan. */
export function summary(plan: Plan) {
  const total = plan.steps.length
  const done = plan.steps.filter(s => s.status === 'completed').length
  const current = plan.steps.find(s => s.status === 'in_progress')
  const next = plan.steps.find(s => s.status === 'pending')
  return { total, done, current, next, isDone: total > 0 && done === total }
}
