import { useEffect, useMemo, useRef, useState } from 'react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { ACTIVITY_PROJECTION_KEY, readActivityAt } from '../core/activity.ts'

/** Fill listing omissions once per sidebar lifetime; native summaries remain untouched. */
export function useActivityList(list: SessionListState, archivedIds: readonly SessionId[]): {
  list: SessionListState
  loading: boolean
  unavailable: boolean
} {
  const [recovered, setRecovered] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const attempted = useRef(new Set<string>())
  const missing = useMemo(() => {
    if (list.phase !== 'ready') return '[]'
    const archived = new Set(archivedIds)
    return JSON.stringify(list.ids.filter(id => {
      const summary = list.byId[id]
      return summary !== undefined && !summary.blank && summary.origin !== 'subagent'
        && !archived.has(id) && readActivityAt(summary.projectionValues) === undefined
    }))
  }, [list, archivedIds])

  useEffect(() => {
    const ids = (JSON.parse(missing) as string[]).filter(id => !attempted.current.has(id))
    if (ids.length === 0) { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true)
    void (async () => {
      try {
        for (let offset = 0; offset < ids.length; offset += 32) {
          const batch = ids.slice(offset, offset + 32)
          const params = new URLSearchParams(batch.map(id => ['id', id]))
          const response = await fetch(`/workspace-groups/activity?${params}`, { cache: 'no-store', signal: controller.signal })
          if (!response.ok) throw new Error('activity unavailable')
          const body = await response.json() as { activityAt?: Record<string, unknown>; unavailable?: unknown }
          const values: Record<string, number> = {}
          for (const id of batch) {
            const value = body.activityAt?.[id]
            if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) values[id] = value
            else setUnavailable(true)
            attempted.current.add(id)
          }
          setRecovered(previous => ({ ...previous, ...values }))
        }
      } catch {
        if (!controller.signal.aborted) {
          ids.forEach(id => attempted.current.add(id))
          setUnavailable(true)
        }
      } finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => { controller.abort() }
  }, [missing])

  const activityList = useMemo(() => {
    const byId = { ...list.byId }
    let changed = false
    for (const id of list.ids) {
      const summary = byId[id]
      const value = recovered[id]
      if (summary === undefined || value === undefined) continue
      const nativeActivity = readActivityAt(summary.projectionValues)
      if (nativeActivity !== undefined && nativeActivity >= value) continue
      const projectionValues = { ...summary.projectionValues, [ACTIVITY_PROJECTION_KEY]: value }
      byId[id] = { ...summary, projectionValues }
      changed = true
    }
    return changed ? { ...list, byId } : list
  }, [list, recovered])
  return { list: activityList, loading, unavailable }
}
