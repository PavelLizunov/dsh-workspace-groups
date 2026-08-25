/**
 * Store action tests: expansion semantics must match the official
 * ui-workspace store — a collapse writes `false` (key retained), never
 * deletes the key, so the auto-expand guard (`Object.hasOwn`) can tell
 * "user collapsed this" from "user never touched this".
 *
 * Tested against the pure action implementations (the defineStore wrapper is
 * a thin binder over these; the runtime bundle needs a browser loader we do
 * not pull into this suite).
 */
import { describe, expect, it } from 'vitest'
import {
  captureExpansionSnapshot,
  retainKeysImpl,
  restoreExpansionSnapshotImpl,
  setCategoryExpandedImpl,
  setWorkspaceExpandedImpl,
  type GroupsViewState,
} from '../src/client/store-core.ts'

function freshState(): GroupsViewState {
  return { categoryExpansion: {}, workspaceExpansion: {} }
}

describe('groups view store expansion semantics', () => {
  it('setCategoryExpanded(true) stores the key as true', () => {
    const state = freshState()
    setCategoryExpandedImpl(state, 'DSH Plugins', true)
    expect(state.categoryExpansion['DSH Plugins']).toBe(true)
  })

  it('setCategoryExpanded(false) retains the key with false (never deletes)', () => {
    const state = freshState()
    setCategoryExpandedImpl(state, 'DSH Plugins', false)
    // The key must EXIST with false — this is what lets the auto-expand
    // guard distinguish a deliberate collapse from an untouched key.
    expect(state.categoryExpansion).toHaveProperty('DSH Plugins', false)
    expect('DSH Plugins' in state.categoryExpansion).toBe(true)
  })

  it('setWorkspaceExpanded(false) retains the key with false', () => {
    const state = freshState()
    setWorkspaceExpandedImpl(state, 'ws-1', false)
    expect(state.workspaceExpansion).toHaveProperty('ws-1', false)
    expect('ws-1' in state.workspaceExpansion).toBe(true)
  })

  it('restores temporary drag folding when the state was not changed by the user', () => {
    const state: GroupsViewState = {
      categoryExpansion: { A: true },
      workspaceExpansion: { 'ws-1': true },
    }
    const snapshot = captureExpansionSnapshot(state)
    state.categoryExpansion.A = false
    state.workspaceExpansion['ws-1'] = false
    restoreExpansionSnapshotImpl(state, snapshot, [], [])
    expect(state.categoryExpansion.A).toBe(true)
    expect(state.workspaceExpansion['ws-1']).toBe(true)
  })

  it('does not overwrite a user toggle made after temporary drag folding', () => {
    const state: GroupsViewState = {
      categoryExpansion: { A: true },
      workspaceExpansion: { 'ws-1': true },
    }
    const snapshot = captureExpansionSnapshot(state)
    state.categoryExpansion.A = false
    state.workspaceExpansion['ws-1'] = false
    state.categoryExpansion.A = true
    state.workspaceExpansion['ws-1'] = true
    restoreExpansionSnapshotImpl(state, snapshot, ['A'], ['ws-1'])
    expect(state.categoryExpansion.A).toBe(true)
    expect(state.workspaceExpansion['ws-1']).toBe(true)
  })

  it('restores untouched siblings while preserving a user-toggled key', () => {
    const state: GroupsViewState = {
      categoryExpansion: { A: false, B: false },
      workspaceExpansion: {},
    }
    const snapshot = { categories: { A: true, B: true }, workspaces: {} }
    state.categoryExpansion.A = true
    restoreExpansionSnapshotImpl(state, snapshot, ['A'], [])
    expect(state.categoryExpansion).toEqual({ A: true, B: true })
  })

  it('retainKeys keeps collapsed keys (deliberate user state survives config churn)', () => {
    const state = freshState()
    setCategoryExpandedImpl(state, 'DSH Plugins', true)
    setCategoryExpandedImpl(state, 'Personal Projects', false)
    retainKeysImpl(state, ['DSH Plugins', 'Personal Projects'], [])
    expect(state.categoryExpansion).toEqual({ 'DSH Plugins': true, 'Personal Projects': false })
  })

  it('retainKeys drops keys for removed categories', () => {
    const state = freshState()
    setCategoryExpandedImpl(state, 'Old Category', true)
    retainKeysImpl(state, ['New Category'], [])
    expect(state.categoryExpansion).toEqual({})
  })

  it('retainKeys drops workspace keys for deleted workspaces', () => {
    const state = freshState()
    setWorkspaceExpandedImpl(state, 'ws-gone', false)
    retainKeysImpl(state, [], ['ws-kept'])
    expect(state.workspaceExpansion).toEqual({})
  })
})
