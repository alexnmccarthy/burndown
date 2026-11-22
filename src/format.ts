/** Pure text formatting. Everything here is table-tested. */

/** An estimate in dollars, fixed to at most 6 cells so the bar never jumps. */
export function money(usd: number): string {
  if (!Number.isFinite(usd) || usd < 0) return '≈?'
  if (usd < 10) return `≈$${usd.toFixed(2)}`
  if (usd < 1000) return `≈$${Math.round(usd)}`
  return `≈$${(usd / 1000).toFixed(1)}k`
}

/** Time until a reset: "40m", "2h 10m", "3d 4h". No time zone needed. */
export function untilReset(at: number, now: number): string {
  const mins = Math.max(0, Math.round((at - now) / 60_000))
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  if (h < 24) return mins % 60 ? `${h}h ${mins % 60}m` : `${h}h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`
}

/** The label for a rate-limit window kind. */
export function limitLabel(kind: string): string {
  if (kind === 'five_hour') return '5h'
  if (kind === 'seven_day') return '7d'
  if (kind === 'spend_limit') return 'spend'
  return kind
}

/** Eight levels of block characters for a sparkline any surface can draw. */
const BLOCKS = '▁▂▃▄▅▆▇█'
export function sparkline(values: readonly number[]): string {
  if (values.length === 0) return ''
  const max = Math.max(...values)
  if (max <= 0) return BLOCKS[0]!.repeat(values.length)
  return values.map(v => BLOCKS[Math.min(7, Math.floor((v / max) * 7.999))]).join('')
}

/** Cut a title to `n` cells with an ellipsis. */
export function clip(text: string, n: number): string {
  if (n <= 1) return text.slice(0, Math.max(0, n))
  return text.length <= n ? text : `${text.slice(0, n - 1)}…`
}
