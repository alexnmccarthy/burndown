/** The canvas's two small drawings, as SVG for surfaces that draw it. Pure. */

export const COBALT = '#2B4BEE'
const TRACK = '#DCE2FC'
const SOFT = '#B9C3F7'
const ORANGE = '#C76E00'
const RED = '#C9372C'

/** The fill colour by how full: cobalt, then orange from 60%, red from 85%. */
export const fillFor = (pct: number) => (pct >= 85 ? RED : pct >= 60 ? ORANGE : COBALT)

/** The plan chip's dot, drawn outside the button so a native button can't drop its colour. */
export const DOT = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="${COBALT}"/></svg>`

/** A 72×6 rounded meter. */
export function meterSvg(pct: number, width = 72, fill = fillFor(pct)): string {
  const w = Math.max(0, Math.min(100, pct)) * (width / 100)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="6" viewBox="0 0 ${width} 6">` +
    `<rect width="${width}" height="6" rx="3" fill="${TRACK}"/>` +
    (w > 0 ? `<rect width="${w.toFixed(1)}" height="6" rx="3" fill="${fill}"/>` : '') +
    `</svg>`
  )
}

/** Bars 3 wide, 2 apart, 16 tall; the newest in cobalt. */
export function sparkSvg(values: readonly number[]): string {
  const max = Math.max(...values, 0)
  const width = values.length * 5 - 2
  const bars = values
    .map((v, n) => {
      const h = Math.round(4 + (max > 0 ? v / max : 0) * 12)
      const fill = n === values.length - 1 ? COBALT : SOFT
      return `<rect x="${n * 5}" y="${16 - h}" width="3" height="${h}" rx="1" fill="${fill}"/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="16" viewBox="0 0 ${width} 16">${bars}</svg>`
}
