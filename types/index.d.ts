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

/** Earlier windows of this run: their spend and the count, this one included. */
export type BurndownRun = { priorUsd: number; windows: number }

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
      run: Shaped<BurndownRun>
      /** Whether the plan card is open above the bar. */
      isPlanOpen: Shaped<boolean>
    }
  }
}
