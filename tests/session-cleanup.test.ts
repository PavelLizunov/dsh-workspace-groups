import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import { describe, expect, it } from 'vitest'
import { findOldSessionsToArchive } from '../src/client/session-cleanup.ts'

function sid(id: string): SessionId {
  return id as never as SessionId
}

function makeSession(props: Omit<Partial<SessionSummary>, 'id'> & { id: string }): SessionSummary {
  const { id, ...rest } = props
  return {
    id: sid(id),
    displayTitle: rest.displayTitle ?? `Session ${id}`,
    blank: rest.blank ?? false,
    running: rest.running ?? false,
    updatedAt: rest.updatedAt ?? Date.now(),
    origin: rest.origin,
    ...rest,
  } as unknown as SessionSummary
}

describe('findOldSessionsToArchive', () => {
  const now = 1_700_000_000_000
  const dayMs = 86_400_000

  it('filters sessions older than specified days', () => {
    const s1 = makeSession({ id: 's1', updatedAt: now - 31 * dayMs }) // 31 days old
    const s2 = makeSession({ id: 's2', updatedAt: now - 10 * dayMs }) // 10 days old
    const s3 = makeSession({ id: 's3', updatedAt: now - 50 * dayMs }) // 50 days old

    const result = findOldSessionsToArchive([s1, s2, s3], {
      pendingInteractions: new Map(),
      days: 30,
      now,
      archivedSessionIds: [],
    })

    // Should return s3 and s1 sorted oldest first
    expect(result.map(s => s.id)).toEqual([sid('s3'), sid('s1')])
  })

  it('excludes running sessions even if older than cutoff', () => {
    const s1 = makeSession({ id: 's1', updatedAt: now - 40 * dayMs, running: true })
    const s2 = makeSession({ id: 's2', updatedAt: now - 40 * dayMs, running: false })

    const result = findOldSessionsToArchive([s1, s2], {
      pendingInteractions: new Map(),
      days: 30,
      now,
      archivedSessionIds: [],
    })

    expect(result.map(s => s.id)).toEqual([sid('s2')])
  })

  it('excludes sessions with pending interaction', () => {
    const s1 = makeSession({ id: 's1', updatedAt: now - 40 * dayMs })
    const s2 = makeSession({ id: 's2', updatedAt: now - 40 * dayMs })

    const result = findOldSessionsToArchive([s1, s2], {
      pendingInteractions: new Map([[s1.id, { key: 'question-1', kind: 'question', sessionId: s1.id }]]),
      days: 30,
      now,
      archivedSessionIds: [],
    })

    expect(result.map(s => s.id)).toEqual([sid('s2')])
  })

  it('excludes current session and blank sessions', () => {
    const s1 = makeSession({ id: 's1', updatedAt: now - 40 * dayMs })
    const s2 = makeSession({ id: 's2', updatedAt: now - 40 * dayMs, blank: true })

    const result = findOldSessionsToArchive([s1, s2], {
      pendingInteractions: new Map(),
      days: 30,
      now,
      currentSessionId: sid('s1'),
      archivedSessionIds: [],
    })

    expect(result).toEqual([])
  })

  it('excludes subagent sessions and already archived sessions', () => {
    const s1 = makeSession({ id: 's1', updatedAt: now - 40 * dayMs, origin: 'subagent' })
    const s2 = makeSession({ id: 's2', updatedAt: now - 40 * dayMs })
    const s3 = makeSession({ id: 's3', updatedAt: now - 40 * dayMs })

    const result = findOldSessionsToArchive([s1, s2, s3], {
      pendingInteractions: new Map(),
      days: 30,
      now,
      archivedSessionIds: [sid('s2')],
    })

    expect(result.map(s => s.id)).toEqual([sid('s3')])
  })

  it('restricts to target workspace session ids when provided', () => {
    const s1 = makeSession({ id: 's1', updatedAt: now - 40 * dayMs })
    const s2 = makeSession({ id: 's2', updatedAt: now - 40 * dayMs })
    const s3 = makeSession({ id: 's3', updatedAt: now - 40 * dayMs })

    const result = findOldSessionsToArchive([s1, s2, s3], {
      pendingInteractions: new Map(),
      days: 30,
      now,
      archivedSessionIds: [],
      targetWorkspaceSessionIds: [sid('s1'), sid('s3')],
    })

    expect(result.map(s => s.id)).toEqual([sid('s1'), sid('s3')])
  })
})
