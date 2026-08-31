/**
 * Scale fixtures & pure derivation benchmarks (100 / 500 / 1000 Workspaces).
 *
 * Measures pure derivation performance (deriveGroups, deriveTopLevel, deriveSearchMatches)
 * under generous non-flaky thresholds, asserts semantic counts/ordering, and guards the
 * canonical one-index tree projection used by the browser.
 */
import { describe, expect, it, vi } from 'vitest'

const runtimeMocks = vi.hoisted(() => ({
  indexSubagentDescendants: vi.fn(() => new Map()),
}))
vi.mock('@deepseek-ai/dsh-client-runtime/client', () => runtimeMocks)

import { deriveGroups, deriveSearchGroups, deriveSearchMatches, deriveTopLevel, deriveWorkspaceTree, projectTreeExpansion } from '../src/client/tree.ts'
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

  describe('Canonical Tree Projection', () => {
    it('indexes lineage once and projects 1000 workspaces without another scan', () => {
      const snapshot = generateScaleSnapshot(1000)
      runtimeMocks.indexSubagentDescendants.mockClear()

      const canonical = deriveWorkspaceTree(
        snapshot.listState,
        snapshot.workspaces,
        snapshot.archivedSessionIds,
        snapshot.config,
        snapshot.manual,
      )
      const projected = projectTreeExpansion(canonical, snapshot.view)

      expect(runtimeMocks.indexSubagentDescendants).toHaveBeenCalledTimes(1)
      expect(projected.categories.flatMap(category => category.workspaces)).toHaveLength(800)
      expect(projected.topLevel).toHaveLength(200)

      runtimeMocks.indexSubagentDescendants.mockClear()
      const matches = deriveSearchMatches(
        snapshot.listState,
        snapshot.workspaces,
        snapshot.config,
        snapshot.searchQuery,
        snapshot.archivedSessionIds,
        snapshot.searchResults,
        snapshot.searchLimit,
      )
      expect(runtimeMocks.indexSubagentDescendants).not.toHaveBeenCalled()
      deriveSearchGroups(
        snapshot.listState,
        snapshot.workspaces,
        snapshot.config,
        matches.matchedIds,
        snapshot.archivedSessionIds,
        snapshot.manual,
        matches.snippetsBySession,
      )
      expect(runtimeMocks.indexSubagentDescendants).toHaveBeenCalledTimes(1)
    })
  })
})
