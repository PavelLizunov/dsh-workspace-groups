import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import { indexSubagentDescendants } from '../src/client/subagent-lineage.ts'

const sid = (value: string) => value as SessionId
const summary = (id: string, extra: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id),
  displayTitle: id,
  blank: false,
  running: false,
  updatedAt: 1000,
  ...extra,
})

describe('subagent-lineage structural memoization', () => {
  it('reuses cached map when irrelevant fields (title, updatedAt) change', () => {
    const root = summary('root')
    const child = summary('child', { origin: 'subagent', parentId: root.id, running: true })
    const byId1 = { [root.id]: root, [child.id]: child }

    const res1 = indexSubagentDescendants(byId1)
    expect(res1.get(root.id)).toEqual({ count: 1, runningCount: 1 })

    // Simulate new object from store, but only displayTitle and updatedAt changed
    const rootUpdated = { ...root, displayTitle: 'Renamed Root', updatedAt: 2000 }
    const childUpdated = { ...child, displayTitle: 'Renamed Child', updatedAt: 2000 }
    const byId2 = { [root.id]: rootUpdated, [child.id]: childUpdated }

    const res2 = indexSubagentDescendants(byId2)
    // MUST return the exact same Map instance (cached)
    expect(res2).toBe(res1)
  })

  it('invalidates cache when running status flips', () => {
    const root = summary('root')
    const child = summary('child', { origin: 'subagent', parentId: root.id, running: true })
    const byId1 = { [root.id]: root, [child.id]: child }

    const res1 = indexSubagentDescendants(byId1)
    expect(res1.get(root.id)).toEqual({ count: 1, runningCount: 1 })

    // Child finishes: running becomes false
    const childFinished = { ...child, running: false }
    const byId2 = { [root.id]: root, [child.id]: childFinished }

    const res2 = indexSubagentDescendants(byId2)
    expect(res2).not.toBe(res1)
    expect(res2.get(root.id)).toEqual({ count: 1, runningCount: 0 })
  })

  it('invalidates cache when parentId changes', () => {
    const root1 = summary('root1')
    const root2 = summary('root2')
    const child = summary('child', { origin: 'subagent', parentId: root1.id, running: true })
    const byId1 = { [root1.id]: root1, [root2.id]: root2, [child.id]: child }

    const res1 = indexSubagentDescendants(byId1)
    expect(res1.get(root1.id)).toEqual({ count: 1, runningCount: 1 })
    expect(res1.get(root2.id)).toBeUndefined()

    // Reparent child to root2
    const childReparented = { ...child, parentId: root2.id }
    const byId2 = { [root1.id]: root1, [root2.id]: root2, [child.id]: childReparented }

    const res2 = indexSubagentDescendants(byId2)
    expect(res2).not.toBe(res1)
    expect(res2.get(root1.id)).toBeUndefined()
    expect(res2.get(root2.id)).toEqual({ count: 1, runningCount: 1 })
  })

  it('invalidates cache when a subagent is added or removed', () => {
    const root = summary('root')
    const child1 = summary('child1', { origin: 'subagent', parentId: root.id, running: true })
    const byId1 = { [root.id]: root, [child1.id]: child1 }

    const res1 = indexSubagentDescendants(byId1)
    expect(res1.get(root.id)).toEqual({ count: 1, runningCount: 1 })

    // Add child2
    const child2 = summary('child2', { origin: 'subagent', parentId: root.id, running: false })
    const byId2 = { [root.id]: root, [child1.id]: child1, [child2.id]: child2 }

    const res2 = indexSubagentDescendants(byId2)
    expect(res2).not.toBe(res1)
    expect(res2.get(root.id)).toEqual({ count: 2, runningCount: 1 })

    // Remove child1
    const byId3 = { [root.id]: root, [child2.id]: child2 }
    const res3 = indexSubagentDescendants(byId3)
    expect(res3).not.toBe(res2)
    expect(res3.get(root.id)).toEqual({ count: 1, runningCount: 0 })
  })

  it('preserves multi-level ancestor chain root -> A(running:false) -> B(running:true)', () => {
    const root = summary('root')
    const childA = summary('childA', { origin: 'subagent', parentId: root.id, running: false })
    const childB = summary('childB', { origin: 'subagent', parentId: childA.id, running: true })
    const byId = { [root.id]: root, [childA.id]: childA, [childB.id]: childB }

    const res = indexSubagentDescendants(byId)
    expect(res.get(root.id)).toEqual({ count: 2, runningCount: 1 })
    expect(res.get(childA.id)).toEqual({ count: 1, runningCount: 1 })
  })

  it('normalizes parentId and parentSessionId identically across warm and cold cache', () => {
    const root = summary('root')
    const childUsingParentId = summary('child1', { origin: 'subagent', parentId: root.id, running: true })
    const childUsingParentSessionId = summary('child2', {
      origin: 'subagent',
      parentSessionId: root.id,
      running: true,
    } as unknown as Partial<SessionSummary>)

    const byId1 = { [root.id]: root, [childUsingParentId.id]: childUsingParentId }
    const res1 = indexSubagentDescendants(byId1)
    expect(res1.get(root.id)).toEqual({ count: 1, runningCount: 1 })

    const byId2 = { [root.id]: root, [childUsingParentSessionId.id]: childUsingParentSessionId }
    const res2 = indexSubagentDescendants(byId2)
    expect(res2.get(root.id)).toEqual({ count: 1, runningCount: 1 })
  })
})
