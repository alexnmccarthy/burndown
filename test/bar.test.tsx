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
    expect((await ui.find({ type: 'Text', text: /This window/ }))?.text).toBe('This window')
    expect((await ui.find({ type: 'Text', text: /45% context/ }))?.text).toBe('45% context')
    expect((await ui.find({ type: 'Text', text: /5h 41%/ }))?.text).toContain('5h 41%')
    // The plan chip: count and the step in flight.
    expect((await ui.find({ key: 'plan' }))?.text).toContain('0/1 Wire payment step')
    // The context meter is a drawing where the surface has one, block characters on the terminal.
    if (surface === 'terminal') expect(await ui.find({ type: 'Svg' })).toBe(undefined)
    else expect((await ui.find({ type: 'Svg' }))?.props).toMatchObject({ alt: '45% of the context window used' })
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
  expect((await ui.find({ type: 'Text', text: /30%/ }))?.text).toBe('30%')
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

test('no plan: Track fills the prompt with a request for a task list, and sends nothing', async ($, on) => {
  const filled: string[] = []
  const submitted: string[] = []
  on('session.usage', () => ({ value: usage(20) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: NOW }))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  on('prompt.submit', (_, e) => {
    submitted.push(e.text)
    return { text: e.text }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...band(120), surface: 'desktop' })
  expect(await ui.find({ key: 'plan' })).toBe(undefined)
  await ui.press({ key: 'track' })
  expect(filled[0]).toContain('task list')
  expect(submitted).toEqual([])
  await ui.unmount()
})

test('the plan chip opens the plan card; the card lists every step on every surface', async ($, on) => {
  const opened: string[] = []
  on('session.usage', () => ({ value: usage(40) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: NOW }))
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Audit current flow', status: 'completed', activeForm: 'a' },
      { content: 'Wire payment step', status: 'in_progress', activeForm: 'b' },
      { content: 'Error states', status: 'pending', activeForm: 'c' },
    ],
  })

  const bandUi = await $.ui.mount({ ...band(120), surface: 'desktop' })
  await bandUi.press({ key: 'plan' })
  expect(opened).toEqual(['burndown'])
  await bandUi.unmount()

  for (const surface of SURFACES) {
    for (const placement of ['dock', 'widget'] as const) {
      const card = await $.ui.mount({
        plugin: 'burndown',
        component: 'Pane',
        requestId: 'burndown',
        surface,
        props: { title: 'Plan', isFocused: false, bodyColumns: 40, placement, scroll: { offset: 0, bodyRows: 20 }, view: {} },
      })
      expect((await card.find({ type: 'Text', text: /step 2 of 3/ }))?.text).toContain('Window 1 · step 2 of 3')
      expect((await card.find({ type: 'Text', text: /Wire payment step/ }))?.text).toContain('Wire payment step')
      if (placement === 'dock') {
        expect((await card.find({ type: 'Text', text: /^Audit current flow$/ }))?.props).toMatchObject({ strikethrough: true })
        expect((await card.find({ type: 'Text', text: /Up next/ }))?.text).toContain('Up next')
      } else {
        // The glance shows the step in flight and the next one, nothing to click.
        expect((await card.find({ type: 'Text', text: /next: Error states/ }))?.text).toContain('Error states')
        expect(await card.find({ key: 'pane-handoff' })).toBe(undefined)
      }
      await card.unmount()
    }
  }
})

test('a /clear starts window 2 and the bar shows the total across windows', async ($, on) => {
  let usd = 4
  on('session.usage', () => ({ value: usage(30, [], usd) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('clock.now', () => ({ value: NOW }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })

  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { sessionId: 's1' } } as never)
  usd = 1.5
  await $.turn.complete({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't2', reason: 'answer' })

  const ui = await $.ui.mount({ ...band(120), surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Total/ }))?.text).toContain('Total')
  expect((await ui.find({ type: 'Text', text: /≈\$5\.50/ }))?.text).toBe('≈$5.50')
  await ui.unmount()
})

test("the desktop app's own task list drives the chip, step by step", async ($, on) => {
  on('session.usage', () => ({ value: usage(40) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: NOW }))
  on('tool.call', () => ({ result: 'Plan shown (3 steps).' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const chip = async () => {
    const ui = await $.ui.mount({ ...band(120), surface: 'desktop' })
    const b = await ui.find({ type: 'Button', key: 'plan' })
    await ui.unmount()
    return b?.text
  }

  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [
      { content: 'Find the cause', status: 'in_progress' },
      { content: 'Fix the visual', status: 'pending' },
      { content: 'Push', status: 'pending' },
    ],
    scope: 'continuation',
  })
  expect(await chip()).toContain('0/3 Find the cause')
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', advance: true })
  expect(await chip()).toContain('1/3 Fix the visual')
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', done: [2, 3] })
  expect(await chip()).toContain('3/3 done')
})

test('a mid-width bar still names the current step on the chip', async ($, on) => {
  on('session.usage', () => ({ value: usage(40) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.now', () => ({ value: NOW }))
  on('tool.call', () => ({ result: 'ok' }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [{ content: 'Read what the probe recorded', status: 'in_progress' }, { content: 'Fix', status: 'pending' }],
  })
  const ui = await $.ui.mount({ ...band(80), surface: 'desktop' })
  expect((await ui.find({ type: 'Button', key: 'plan' }))?.text).toContain('0/2 Read what')
})
