import { expect, test } from 'claude-code/testing'

import { BRIEF_PROMPT } from '../src/handoff'

const NOW = 1_000_000_000_000
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

const band = (bodyColumns: number) =>
  ({
    plugin: 'burndown',
    component: 'AbovePrompt',
    requestId: 'band',
    props: {
      hasSurvey: false,
      isCollapsed: false,
      isWorking: false,
      maxRows: 10,
      bodyColumns,
      scroll: { offset: 0, bodyRows: 10 },
      view: {},
    },
  }) as const

const usage = (contextPct: number, limits: { kind: string; percentUsed: number }[] = [], usd = 3.1) => ({
  startedAt: 0,
  context: { window: 200_000, percent: contextPct, tokens: contextPct * 2000 },
  rateLimits: limits,
  cost: { usd },
})

test('the bar shows context, the 5-hour limit and the plan on every surface', async ($, on) => {
  on('session.usage', () => ({ value: usage(45, [{ kind: 'five_hour', percentUsed: 41 }]) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: NOW }))
  on('tool.call', (_, e) =>
    e.tool === 'TaskCreate'
      ? { result: { task: { id: '1', subject: 'Wire payment step' } } }
      : { result: { success: true, taskId: '1', updatedFields: ['status'] } },
  )

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'TaskCreate', subject: 'Wire payment step', description: 'x' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'in_progress' })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...band(120), surface })
    expect((await ui.find({ type: 'Text', text: /ctx 45%/ }))?.text).toContain('ctx 45%')
    expect((await ui.find({ type: 'Text', text: /5h 41%/ }))?.text).toContain('5h 41%')
    expect((await ui.find({ type: 'Text', text: /0\/1 Wire payment/ }))?.text).toContain('Wire payment')
    // Not tight yet: no Handoff button.
    expect(await ui.find({ key: 'handoff' })).toBe(undefined)
    await ui.unmount()
  }
})

test('on an API key the bar shows dollars, and Handoff once the window is tight', async ($, on) => {
  on('session.usage', () => ({ value: usage(71, [], 3.104) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: NOW }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...band(100), surface })
    expect((await ui.find({ type: 'Text', text: /≈\$3\.10/ }))?.text).toContain('≈$3.10')
    expect(await ui.find({ key: 'handoff' })).not.toBe(undefined)
    await ui.unmount()
  }
})

test('a narrow column keeps context and drops the rest', async ($, on) => {
  on('session.usage', () => ({ value: usage(30, [], 1) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: NOW }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({ ...band(40), surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /ctx 30%/ }))?.text).toContain('ctx 30%')
  expect(await ui.find({ type: 'Text', text: /≈\$/ })).toBe(undefined)
  await ui.unmount()
})

test('Handoff asks Claude for a brief, then Start next window clears and fills the prompt', async ($, on) => {
  const submitted: string[] = []
  const commands: string[] = []
  const filled: string[] = []
  on('session.usage', () => ({ value: usage(80) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: NOW }))
  on('prompt.submit', (_, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  on('command.run', (_, e) => {
    commands.push(e.command)
    return { text: '' }
  })
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId ?? 'x' }))
  on('turn.complete', (_, e) => ({ text: e.answer }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...band(120), surface: 'desktop' })

  await ui.press({ key: 'handoff' })
  expect(submitted[0]).toContain('handoff brief')
  expect((await ui.find({ type: 'Text', text: /Writing brief/ }))?.text).toContain('Writing brief')

  await $.turn.start({ text: BRIEF_PROMPT, turnId: 't1' })
  await $.turn.complete({ answer: 'Goal: ship checkout\nNext: error states', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
  await ui.press({ key: 'next' })
  expect(commands).toEqual(['clear'])
  expect(filled[0]).toContain('Next: error states')
  await ui.unmount()
})

test('a turn already running when Handoff is pressed is not taken for the brief', async ($, on) => {
  on('session.usage', () => ({ value: usage(80) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: NOW }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.start', (_, e) => ({ turnId: e.turnId ?? 'x' }))
  on('turn.complete', (_, e) => ({ text: e.answer }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...band(120), surface: 'desktop' })
  await ui.press({ key: 'handoff' })
  await $.turn.start({ text: 'fix the bug', turnId: 'old' })
  await $.turn.complete({ answer: 'Fixed.', durationMs: 1, isAborted: false, turnId: 'old', reason: 'answer' })
  expect((await ui.find({ type: 'Text', text: /Writing brief/ }))?.text).toContain('Writing brief')
  expect(await ui.find({ key: 'next' })).toBe(undefined)
  await ui.unmount()
})

test('a refused Handoff submit returns the bar to idle', async ($, on) => {
  on('session.usage', () => ({ value: usage(80) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: NOW }))
  on('prompt.submit', () => ({ drop: 'no' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...band(120), surface: 'desktop' })
  await ui.press({ key: 'handoff' })
  expect(await ui.find({ type: 'Text', text: /Writing brief/ })).toBe(undefined)
  expect(await ui.find({ key: 'handoff' })).not.toBe(undefined)
  await ui.unmount()
})
