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

  it('keeps pinned sessions visible even when outside the first five', () => {
    const withPinned = [
      { id: 's1' as never },
      { id: 's2' as never },
      { id: 's3' as never },
      { id: 's4' as never },
      { id: 's5' as never },
      { id: 's6' as never },
      { id: 's7' as never, pinned: true },
      { id: 's8' as never },
    ]
    expect(visibleWorkspaceSessions(withPinned, undefined, false)).toEqual([
      withPinned[0],
      withPinned[1],
      withPinned[2],
      withPinned[3],
      withPinned[4],
      withPinned[6], // s7 is pinned!
    ])
  })

  it('keeps color-tagged sessions visible even when outside the first five', () => {
    const withColor = [
      { id: 's1' as never },
      { id: 's2' as never },
      { id: 's3' as never },
      { id: 's4' as never },
      { id: 's5' as never },
      { id: 's6' as never },
      { id: 's7' as never, color: 'red' },
      { id: 's8' as never },
    ]
    expect(visibleWorkspaceSessions(withColor, undefined, false)).toEqual([
      withColor[0],
      withColor[1],
      withColor[2],
      withColor[3],
      withColor[4],
      withColor[6],
    ])
  })
})
