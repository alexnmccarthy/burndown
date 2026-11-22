/**
 * Handoff without any access of the mod's own: Claude writes the brief as its
 * reply, and the mod carries that reply into the next window's prompt box.
 * No file is written, no model is called by the mod, nothing leaves the machine.
 */

export const BRIEF_PROMPT = [
  'Burndown handoff: this context window is getting full, so the work continues in a fresh one.',
  'Reply with ONLY a handoff brief for the next window, in this shape, under 300 words, nothing before or after it:',
  '',
  'Goal: <one line: what we are building and why>',
  'Done: <what is finished, with file paths, issue or PR numbers>',
  'Next: <the very next step, concrete enough to start without asking>',
  'Open: <decisions or questions still waiting on me, or "none">',
  'Watch out: <traps, gotchas, things that failed, or "none">',
  'Files: <the files the next window should read first>',
  '',
  'Do not run any tools for this. Do not include secrets, keys or tokens.',
].join('\n')

/** The prompt the next window starts with. The person reads and edits it before sending. */
export function nextWindowPrompt(brief: string): string {
  return `Continuing from the previous context window. Here is the handoff brief:\n\n${brief}\n\nRead the files listed above, then carry on with Next.`
}
