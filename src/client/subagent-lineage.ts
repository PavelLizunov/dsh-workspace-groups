/** Workspace-groups-owned projection of uninterrupted subagent descendants. */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'

export interface SubagentDescendantSummary {
  readonly count: number
  readonly runningCount: number
}

interface CachedLineageSlot {
  readonly keyMap: Map<SessionId, string>
  readonly result: ReadonlyMap<SessionId, SubagentDescendantSummary>
}

let cachedSlot: CachedLineageSlot | null = null

/** Count descendants through subagent-only lineage, stopping at missing parents or cycles. */
export function indexSubagentDescendants(
  summaries: Readonly<Record<SessionId, SessionSummary>>,
): ReadonlyMap<SessionId, SubagentDescendantSummary> {
  const currentTopology = new Map<SessionId, string>()
  let subagentsCount = 0

  for (const s of Object.values(summaries)) {
    if (s.origin === 'subagent') {
      subagentsCount++
      const parentId = s.parentId ?? (s as unknown as { parentSessionId?: string }).parentSessionId ?? ''
      currentTopology.set(s.id, `${parentId}:${s.running ? '1' : '0'}`)
    }
  }

  if (cachedSlot !== null && cachedSlot.keyMap.size === subagentsCount) {
    let match = true
    for (const [id, sig] of currentTopology.entries()) {
      if (cachedSlot.keyMap.get(id) !== sig) {
        match = false
        break
      }
    }
    if (match) {
      return cachedSlot.result
    }
  }

  const indexed = new Map<SessionId, { count: number; runningCount: number }>()
  for (const descendant of Object.values(summaries)) {
    if (descendant.origin !== 'subagent') continue
    const seen = new Set<SessionId>()
    let current: SessionSummary | undefined = descendant
    while (current?.origin === 'subagent' && !seen.has(current.id)) {
      seen.add(current.id)
      const pid: SessionId | undefined = current.parentId ?? (current as { parentSessionId?: SessionId }).parentSessionId
      if (pid === undefined) break
      const aggregate = indexed.get(pid)
      if (aggregate === undefined) {
        indexed.set(pid, { count: 1, runningCount: descendant.running ? 1 : 0 })
      } else {
        aggregate.count += 1
        if (descendant.running) aggregate.runningCount += 1
      }
      current = summaries[pid]
    }
  }

  cachedSlot = {
    keyMap: currentTopology,
    result: indexed,
  }

  return indexed
}
