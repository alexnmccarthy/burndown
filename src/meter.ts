import type { SessionUsage } from 'claude-code'
import type { BurndownMeter } from '../types'

/** What the bar draws about room and spend, from one `$.session.usage()` read. */
export type Meter = BurndownMeter

export const EMPTY_METER: Meter = { unknownPrice: false, turns: [] }

/** The usage read, reduced to what the bar shows. Pure. */
export function readMeter(u: SessionUsage, prev: Meter): Meter {
  const tightest = [...u.rateLimits].sort((a, b) => b.percentUsed - a.percentUsed)[0]
  const resetsAt = tightest?.resetsAt ? Date.parse(tightest.resetsAt) : Number.NaN
  return {
    contextPct: u.context.percent,
    limit: tightest && {
      kind: tightest.kind,
      pct: tightest.percentUsed,
      resetsAt: Number.isFinite(resetsAt) ? resetsAt : undefined,
    },
    usd: u.cost?.usd,
    unknownPrice: u.cost?.hasUnknownPrice === true,
    turns: prev.turns,
  }
}

/** Adds one turn's spend: the dollars moved since the turn began. */
export function addTurn(m: Meter, usdAtStart: number | undefined): Meter {
  if (m.usd === undefined || usdAtStart === undefined) return m
  const delta = Math.max(0, m.usd - usdAtStart)
  return { ...m, turns: [...m.turns, delta].slice(-12) }
}

/** True once the window is tight enough to offer a handoff. */
export function isTight(m: Meter): boolean {
  return (m.contextPct ?? 0) >= 50 || (m.limit?.pct ?? 0) >= 85
}
