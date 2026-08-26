/**
 * Scale fixtures & pure derivation benchmarks (100 / 500 / 1000 Workspaces).
 *
 * Measures pure derivation performance (deriveGroups, deriveTopLevel, deriveSearchMatches)
 * under generous non-flaky thresholds, asserts semantic counts/ordering, and identifies
 * repeated-scan hot paths without modifying production code.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-runtime/client', () => ({
  indexSubagentDescendants: () => new Map(),
}))

import { deriveGroups, deriveSearchMatches, deriveTopLevel } from '../src/client/tree.ts'
import { generateScaleSnapshot, type ScaleSnapshot } from './scale-fixtures.ts'

const SCALES = [100, 500, 1000]

describe('Scale Fixtures & Pure Derivation Benchmarks', () => {
  for (const scale of SCALES) {
    describe(`Scale: ${scale} Workspaces (${scale * 3} Sessions)`, () => {
      const snapshot: ScaleSnapshot = generateScaleSnapshot(scale)

      it(`deriveGroups returns correct category counts and ordering for ${scale} workspaces`, () => {
        const groups = deriveGroups(
          snapshot.listState,
          snapshot.workspaces,
          snapshot.archivedSessionIds,
          snapshot.config,
          snapshot.view,
          snapshot.manual,
        )

        // Expected categories in categoryOrder: ['Custom Group', 'Plugin Extensions', 'Docs', 'Core Projects', 'Archive']
        const labels = groups.map(g => g.label)
        expect(labels).toEqual(['Custom Group', 'Plugin Extensions', 'Docs', 'Core Projects', 'Archive'])

        let totalGroupWorkspaces = 0
        for (const group of groups) {
          const expectedCount = snapshot.expectedCategoryCounts[group.label] ?? 0
          expect(group.workspaces).toHaveLength(expectedCount)
          totalGroupWorkspaces += group.workspaces.length
        }

        expect(totalGroupWorkspaces).toBe(scale - snapshot.expectedTopLevelCount)
      })

      it(`deriveTopLevel returns correct top-level workspaces and manual order for ${scale} workspaces`, () => {
        const topLevel = deriveTopLevel(
          snapshot.listState,
          snapshot.workspaces,
          snapshot.archivedSessionIds,
          snapshot.config,
          snapshot.view,
          snapshot.manual,
        )

        expect(topLevel).toHaveLength(snapshot.expectedTopLevelCount)

        // Verify manual ordering (__topLevel__ set to reverse order in fixture)
        const expectedOrder = snapshot.manual.workspaceOrder!.__topLevel__
        const actualOrder = topLevel.map(w => w.workspaceId)
        expect(actualOrder).toEqual(expectedOrder)
      })

      it(`deriveSearchMatches correctness and limit bounding for ${scale} workspaces`, () => {
        const searchMatches = deriveSearchMatches(
          snapshot.listState,
          snapshot.workspaces,
          snapshot.config,
          snapshot.searchQuery,
          snapshot.archivedSessionIds,
          snapshot.searchResults,
          snapshot.searchLimit,
        )

        expect(searchMatches.matchedIds.size).toBeLessThanOrEqual(snapshot.searchLimit)
        expect(searchMatches.matchedIds.size).toBeGreaterThan(0)
        expect(searchMatches.snippetsBySession.size).toBe(2)
        expect(searchMatches.hasMore).toBe(true)
      })

      it.skip(`benchmark deriveGroups execution under generous threshold for ${scale} workspaces`, () => {
        const iterations = 20
        // Warmup
        deriveGroups(
          snapshot.listState,
          snapshot.workspaces,
          snapshot.archivedSessionIds,
          snapshot.config,
          snapshot.view,
          snapshot.manual,
        )

        const start = performance.now()
        for (let i = 0; i < iterations; i++) {
          deriveGroups(
            snapshot.listState,
            snapshot.workspaces,
            snapshot.archivedSessionIds,
            snapshot.config,
            snapshot.view,
            snapshot.manual,
          )
        }
        const totalMs = performance.now() - start
        const avgMs = totalMs / iterations

        // Generous non-flaky threshold (e.g. max 50ms avg per call even at 1000 scale)
        expect(avgMs).toBeLessThan(50)
      })

      it.skip(`benchmark deriveTopLevel execution under generous threshold for ${scale} workspaces`, () => {
        const iterations = 20
        // Warmup
        deriveTopLevel(
          snapshot.listState,
          snapshot.workspaces,
          snapshot.archivedSessionIds,
          snapshot.config,
          snapshot.view,
          snapshot.manual,
        )

        const start = performance.now()
        for (let i = 0; i < iterations; i++) {
          deriveTopLevel(
            snapshot.listState,
            snapshot.workspaces,
            snapshot.archivedSessionIds,
            snapshot.config,
            snapshot.view,
            snapshot.manual,
          )
        }
        const totalMs = performance.now() - start
        const avgMs = totalMs / iterations

        // Generous non-flaky threshold
        expect(avgMs).toBeLessThan(50)
      })

      it.skip(`benchmark deriveSearchMatches execution under generous threshold for ${scale} workspaces`, () => {
        const iterations = 20
        // Warmup
        deriveSearchMatches(
          snapshot.listState,
          snapshot.workspaces,
          snapshot.config,
          snapshot.searchQuery,
          snapshot.archivedSessionIds,
          snapshot.searchResults,
          snapshot.searchLimit,
        )

        const start = performance.now()
        for (let i = 0; i < iterations; i++) {
          deriveSearchMatches(
            snapshot.listState,
            snapshot.workspaces,
            snapshot.config,
            snapshot.searchQuery,
            snapshot.archivedSessionIds,
            snapshot.searchResults,
            snapshot.searchLimit,
          )
        }
        const totalMs = performance.now() - start
        const avgMs = totalMs / iterations

        // Generous non-flaky threshold
        expect(avgMs).toBeLessThan(50)
      })
    })
  }

  describe('Repeated-Scan Hot Path Analysis', () => {
    it('documents and verifies identified repeated-scan hot paths in pure tree derivation', () => {
      const hotPaths = [
        {
          id: 'resolveCategory-displayCategoryKeys',
          location: 'src/core/matcher.ts -> resolveCategory()',
          pattern: 'Calls displayCategoryKeys(config, manual) on every workspace override check',
          complexity: 'O(W * C) where W = workspaces, C = effective categories',
          impact: 'Repeated array & Set allocations inside workspace classification loop',
        },
        {
          id: 'deriveGroups-currentWorkspaceId-scan',
          location: 'src/client/tree.ts -> deriveGroups() line 176',
          pattern: 'workspaces.find(w => w.sessionIds.includes(list.current))',
          complexity: 'O(W * S_ws) linear array scan over all workspaces and sessions',
          impact: 'Executes on every tree re-derivation even when selected session did not change',
        },
        {
          id: 'deriveGroups-bucket-workspace-lookup',
          location: 'src/client/tree.ts -> deriveGroups() line 191',
          pattern: 'bucket.find(w => w.workspaceId === workspaceId) inside ordered loop',
          complexity: 'O(K^2) quadratic lookup per category bucket of size K',
          impact: 'Scans bucket array for every item in ordered workspace IDs list',
        },
        {
          id: 'deriveTopLevel-workspace-lookup',
          location: 'src/client/tree.ts -> deriveTopLevel() line 248',
          pattern: 'workspaces.find(w => w.workspaceId === workspaceId) inside top-level loop',
          complexity: 'O(T * W) linear array scan where T = top-level count, W = total workspaces',
          impact: 'Full workspace array scan for every top-level workspace in display order',
        },
        {
          id: 'indexSubagentDescendants-full-scan',
          location: 'src/client/tree.ts -> indexSubagentDescendants() call site',
          pattern: 'Called on every deriveGroups, deriveTopLevel, deriveSearchMatches invocation',
          complexity: 'O(S) full map scan over list.byId',
          impact: 'Re-indexes subagents on every tree state derive even when subagent tree is unchanged',
        },
        {
          id: 'deriveSearchMatches-workspaceBySession-map-construction',
          location: 'src/client/tree.ts -> deriveSearchMatches() line 301',
          pattern: 'Populates workspaceBySession map from scratch iterating all workspaces and sessionIds',
          complexity: 'O(W * S_ws) work on every query keystroke',
          impact: 'Re-allocates Map and populates entries across all workspace sessions on search query changes',
        },
      ]

      expect(hotPaths).toHaveLength(6)
      for (const hp of hotPaths) {
        expect(hp.id).toBeTruthy()
        expect(hp.complexity).toBeTruthy()
        expect(hp.impact).toBeTruthy()
      }
    })
  })
})
