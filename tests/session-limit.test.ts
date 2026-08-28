import { describe, expect, it } from 'vitest'
import { visibleWorkspaceSessions } from '../src/client/session-limit.ts'

const sessions = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map(id => ({ id: id as never }))

describe('visibleWorkspaceSessions', () => {
  it('shows all sessions when the total is within the limit', () => {
    expect(visibleWorkspaceSessions(sessions.slice(0, 4), undefined, false)).toEqual(sessions.slice(0, 4))
  })

  it('shows the first five sessions by default', () => {
    expect(visibleWorkspaceSessions(sessions, undefined, false)).toEqual(sessions.slice(0, 5))
  })

  it('also keeps the selected session visible outside the first five', () => {
    expect(visibleWorkspaceSessions(sessions, 's8' as never, false)).toEqual([...sessions.slice(0, 5), sessions[7]])
  })

  it('shows every session after expansion', () => {
    expect(visibleWorkspaceSessions(sessions, 's8' as never, true)).toEqual(sessions)
  })
})
