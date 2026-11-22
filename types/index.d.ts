export type BurndownStep = {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed'
}
export type BurndownPlan = { steps: BurndownStep[] }

export type BurndownMeter = {
  contextPct?: number
  limit?: { kind: string; pct: number; resetsAt?: number }
  usd?: number
  unknownPrice: boolean
  turns: number[]
}

/** idle: nothing asked. writing: Claude is writing the brief. ready: the brief is in hand. */
export type BurndownHandoff =
  | { stage: 'idle' }
  | { stage: 'writing' }
  | { stage: 'ready'; brief: string }

declare module 'claude-code' {
  interface PluginState {
    burndown: {
      meter: Shaped<BurndownMeter>
      plan: Shaped<BurndownPlan>
      handoff: Shaped<BurndownHandoff>
    }
  }
}
