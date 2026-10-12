/** Latest durable conversation activity, independent of native prompt-only updatedAt. */
export const ACTIVITY_PROJECTION_KEY = 'workspaceGroupsActivityAt'

export function readActivityAt(values: unknown): number | undefined {
  if (typeof values !== 'object' || values === null || Array.isArray(values)) return undefined
  const value = (values as Record<string, unknown>)[ACTIVITY_PROJECTION_KEY]
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

export function sessionActivityAt(summary: { updatedAt: number; projectionValues?: unknown }): number {
  return Math.max(summary.updatedAt, readActivityAt(summary.projectionValues) ?? 0)
}

export function applyActivityAt(state: number, event: { type: string; time?: number; data?: unknown }): number {
  if (event.type === 'user/message') {
    const data = event.data as { source?: { kind?: string } } | undefined
    if (data?.source?.kind !== 'user') return state
  } else if (event.type !== 'assistant/message' && event.type !== 'turn/end') return state
  return typeof event.time === 'number' && Number.isSafeInteger(event.time) && event.time >= 0
    ? Math.max(state, event.time) : state
}
