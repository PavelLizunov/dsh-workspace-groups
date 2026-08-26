import { describe, expect, it } from 'vitest'
import {
  moveWorkspace,
  removeGroup,
  removeWorkspace,
  renameGroup,
} from '../src/client/overlay-core.ts'
import { TOP_LEVEL_ORDER_KEY, type ManualGroups } from '../src/core/types.ts'

describe('overlay-core hygiene mutations', () => {
  describe('removeGroup (orphan group delete)', () => {
    it('removes a manual group and sets matching assignments to null including orphan IDs', () => {
      const manual: ManualGroups = {
        categories: ['GroupA', 'GroupB'],
        assignments: {
          'ws-1': 'GroupA',
          'ws-2': 'GroupB',
          'orphan-id-99': 'GroupA', // orphan ID no longer present in active workspaces
        },
        categoryOrder: ['GroupA', 'GroupB'],
        workspaceOrder: {
          GroupA: ['ws-1', 'orphan-id-99'],
          GroupB: ['ws-2'],
        },
      }

      const result = removeGroup(manual, 'GroupA')

      expect(result.categories).toEqual(['GroupB'])
      expect(result.categoryOrder).toEqual(['GroupB'])
      expect(result.assignments).toEqual({
        'ws-1': null,
        'ws-2': 'GroupB',
        'orphan-id-99': null, // orphan ID assignment set to null
      })
      expect(result.workspaceOrder).toEqual({
        GroupB: ['ws-2'],
      })
      expect(result.workspaceOrder).not.toHaveProperty('GroupA')
    })

    it('handles rule group removal by setting assignments to null and adding to hidden', () => {
      const manual: ManualGroups = {
        categories: [],
        assignments: {
          'ws-1': 'Renamed Rule',
          'orphan-42': 'Original Rule',
        },
        renamed: {
          'Original Rule': 'Renamed Rule',
        },
        hidden: ['Other Rule'],
        workspaceOrder: {
          'Renamed Rule': ['ws-1'],
        },
      }

      const result = removeGroup(manual, 'Renamed Rule', { originalRuleName: 'Original Rule' })

      expect(result.assignments).toEqual({
        'ws-1': null,
        'orphan-42': null,
      })
      expect(result.renamed).toEqual({})
      expect(result.hidden).toEqual(['Other Rule', 'Original Rule'])
      expect(result.workspaceOrder).not.toHaveProperty('Renamed Rule')
    })
  })

  describe('removeWorkspace (workspace delete)', () => {
    it('removes a workspace from assignments and all workspaceOrder arrays', () => {
      const manual: ManualGroups = {
        categories: ['GroupA', 'GroupB'],
        assignments: {
          'ws-deleted': 'GroupA',
          'ws-keep': 'GroupB',
        },
        workspaceOrder: {
          GroupA: ['ws-1', 'ws-deleted'],
          GroupB: ['ws-keep'],
          [TOP_LEVEL_ORDER_KEY]: ['ws-deleted', 'ws-top'],
        },
      }

      const result = removeWorkspace(manual, 'ws-deleted')

      expect(result.assignments).toEqual({
        'ws-keep': 'GroupB',
      })
      expect(result.assignments).not.toHaveProperty('ws-deleted')

      expect(result.workspaceOrder).toEqual({
        GroupA: ['ws-1'],
        GroupB: ['ws-keep'],
        [TOP_LEVEL_ORDER_KEY]: ['ws-top'],
      })
    })
  })

  describe('moveWorkspace (A→B→C stale orders & top-level parity)', () => {
    it('cleans stale order references when moving workspace across A → B → C', () => {
      const initial: ManualGroups = {
        categories: ['GroupA', 'GroupB', 'GroupC'],
        assignments: {},
        workspaceOrder: {},
      }

      // Step 1: Move to GroupA
      const step1 = moveWorkspace(initial, { workspaceId: 'ws-1', targetCategoryKey: 'GroupA' })
      expect(step1.assignments['ws-1']).toBe('GroupA')
      expect(step1.workspaceOrder).toEqual({
        GroupA: ['ws-1'],
      })

      // Step 2: Move to GroupB
      const step2 = moveWorkspace(step1, { workspaceId: 'ws-1', targetCategoryKey: 'GroupB' })
      expect(step2.assignments['ws-1']).toBe('GroupB')
      expect(step2.workspaceOrder!['GroupA']).toEqual([])
      expect(step2.workspaceOrder!['GroupB']).toEqual(['ws-1'])

      // Step 3: Move to GroupC
      const step3 = moveWorkspace(step2, { workspaceId: 'ws-1', targetCategoryKey: 'GroupC' })
      expect(step3.assignments['ws-1']).toBe('GroupC')
      expect(step3.workspaceOrder!['GroupA']).toEqual([])
      expect(step3.workspaceOrder!['GroupB']).toEqual([])
      expect(step3.workspaceOrder!['GroupC']).toEqual(['ws-1'])

      // Verify no stale references exist across all groups
      const allOrders = Object.values(step3.workspaceOrder!).flat()
      expect(allOrders.filter(id => id === 'ws-1')).toHaveLength(1)
    })

    it('provides top-level parity for ordering and moving', () => {
      const manual: ManualGroups = {
        categories: ['GroupA'],
        assignments: {
          'ws-1': 'GroupA',
          'ws-2': null,
        },
        workspaceOrder: {
          GroupA: ['ws-1'],
          [TOP_LEVEL_ORDER_KEY]: ['ws-2'],
        },
      }

      // Move ws-1 from GroupA to top-level
      const toTop = moveWorkspace(manual, { workspaceId: 'ws-1', targetCategoryKey: null, targetMembers: ['ws-2', 'ws-1'] })
      expect(toTop.assignments['ws-1']).toBeNull()
      expect(toTop.workspaceOrder!['GroupA']).toEqual([])
      expect(toTop.workspaceOrder![TOP_LEVEL_ORDER_KEY]).toEqual(['ws-2', 'ws-1'])

      // Move ws-1 before ws-2 within top-level
      const reordered = moveWorkspace(toTop, { workspaceId: 'ws-1', targetCategoryKey: TOP_LEVEL_ORDER_KEY, beforeId: 'ws-2', targetMembers: ['ws-2', 'ws-1'] })
      expect(reordered.workspaceOrder![TOP_LEVEL_ORDER_KEY]).toEqual(['ws-1', 'ws-2'])

    })

    it('respects targetMembers when positioning inside a target group', () => {
      const manual: ManualGroups = {
        categories: ['GroupA'],
        assignments: { 'ws-1': 'GroupA', 'ws-2': 'GroupA', 'ws-3': null },
        workspaceOrder: { GroupA: ['ws-1', 'ws-2'] },
      }

      const moved = moveWorkspace(manual, {
        workspaceId: 'ws-3',
        targetCategoryKey: 'GroupA',
        beforeId: 'ws-2',
        targetMembers: ['ws-1', 'ws-2', 'ws-3'],
      })

      expect(moved.assignments['ws-3']).toBe('GroupA')
      expect(moved.workspaceOrder!['GroupA']).toEqual(['ws-1', 'ws-3', 'ws-2'])
    })
  })

  describe('renameGroup (consistent group rename)', () => {
    it('renames manual group references across categories, categoryOrder, assignments, and workspaceOrder', () => {
      const manual: ManualGroups = {
        categories: ['OldGroup', 'OtherGroup'],
        categoryOrder: ['OtherGroup', 'OldGroup'],
        assignments: {
          'ws-1': 'OldGroup',
          'ws-2': 'OtherGroup',
        },
        workspaceOrder: {
          OldGroup: ['ws-1'],
          OtherGroup: ['ws-2'],
        },
      }

      const result = renameGroup(manual, 'OldGroup', 'NewGroup')

      expect(result.categories).toEqual(['NewGroup', 'OtherGroup'])
      expect(result.categoryOrder).toEqual(['OtherGroup', 'NewGroup'])
      expect(result.assignments).toEqual({
        'ws-1': 'NewGroup',
        'ws-2': 'OtherGroup',
      })
      expect(result.workspaceOrder).toEqual({
        NewGroup: ['ws-1'],
        OtherGroup: ['ws-2'],
      })
      expect(result.workspaceOrder).not.toHaveProperty('OldGroup')
    })

    it('renames rule group references updating renamed map', () => {
      const manual: ManualGroups = {
        categories: [],
        assignments: {
          'ws-1': 'OldDisplay',
        },
        renamed: {
          'RuleKey': 'OldDisplay',
        },
        workspaceOrder: {
          OldDisplay: ['ws-1'],
        },
      }

      const result = renameGroup(manual, 'OldDisplay', 'NewDisplay', { originalRuleName: 'RuleKey' })

      expect(result.assignments).toEqual({
        'ws-1': 'NewDisplay',
      })
      expect(result.renamed).toEqual({
        'RuleKey': 'NewDisplay',
      })
      expect(result.workspaceOrder).toEqual({
        NewDisplay: ['ws-1'],
      })
    })
  })
})
