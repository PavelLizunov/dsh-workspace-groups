import type {
  SessionId,
  SessionListState,
  SessionSearchResultItem,
  SessionSummary,
  WorkspaceId,
  WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { GroupsTreeView } from '../src/client/tree.ts'
import type { GroupsConfig, ManualGroups } from '../src/core/types.ts'

export interface ScaleSnapshot {
  scale: number
  workspaces: WorkspaceView[]
  listState: SessionListState
  config: GroupsConfig
  manual: ManualGroups
  view: GroupsTreeView
  archivedSessionIds: SessionId[]
  searchQuery: string
  searchResults: { items: SessionSearchResultItem[]; hasMore: boolean }
  searchLimit: number
  expectedCategoryCounts: Record<string, number>
  expectedTopLevelCount: number
  expectedTotalSessions: number
}

/**
 * Generates a deterministic snapshot with `scale` Workspaces and 3x Sessions.
 * Distribution per 5 workspaces:
 *  - 0: Core Projects (rule pathPrefix /work/projects)
 *  - 1: Docs (rule basenameContains docs)
 *  - 2: Plugin Extensions (rule nameContains Plugin, renamed from Plugins)
 *  - 3: Custom Group (manual assignment)
 *  - 4: Misc Project (top-level; every 10th forced top-level via null assignment)
 */
export function generateScaleSnapshot(scale: number): ScaleSnapshot {
  const workspaces: WorkspaceView[] = []
  const sessionById: Record<string, SessionSummary> = {}
  const sessionIds: SessionId[] = []
  const archivedSessionIds: SessionId[] = []

  const config: GroupsConfig = {
    categories: [
      { name: 'Plugins', rules: [{ nameContains: 'Plugin' }] },
      { name: 'Docs', rules: [{ basenameContains: 'docs' }] },
      { name: 'Core Projects', rules: [{ pathPrefix: '/work/projects' }] },
    ],
  }

  const manualAssignments: Record<string, string | null> = {}

  let expectedCoreProjects = 0
  let expectedDocs = 0
  let expectedPlugins = 0
  let expectedCustom = 0
  let expectedTopLevel = 0
  let totalSessions = 0

  for (let i = 0; i < scale; i++) {
    const wsId = `ws-${i}` as WorkspaceId
    const modulus = i % 5

    let path = ''
    let title = ''

    if (modulus === 0) {
      path = `/work/projects/app-${i}`
      title = `Core App ${i}`
      expectedCoreProjects++
    } else if (modulus === 1) {
      path = `/home/user/docs-${i}`
      title = `User Docs ${i}`
      expectedDocs++
    } else if (modulus === 2) {
      path = `/src/plugins/plugin-${i}`
      title = `DSH Plugin ${i}`
      expectedPlugins++
    } else if (modulus === 3) {
      path = `/tmp/custom-${i}`
      title = `Custom Project ${i}`
      manualAssignments[wsId] = 'Custom Group'
      expectedCustom++
    } else {
      path = `/var/misc/random-${i}`
      title = `Misc Project ${i}`
      if (i % 10 === 4) {
        manualAssignments[wsId] = null
      }
      expectedTopLevel++
    }

    const wsSessions: SessionId[] = []
    for (let s = 1; s <= 3; s++) {
      const sId = `session-${i}-${s}` as SessionId
      wsSessions.push(sId)
      sessionIds.push(sId)
      totalSessions++

      const isSubagent = s === 3 && i % 20 === 0
      const isArchived = s === 3 && i % 20 === 5

      if (isArchived) {
        archivedSessionIds.push(sId)
      }

      sessionById[sId] = {
        id: sId,
        origin: isSubagent ? 'subagent' : 'user',
        blank: false,
        displayTitle: `Session ${i}-${s} ${i % 2 === 0 ? 'Fix bug' : 'Add feature'}`,
        running: s === 1 && i % 4 === 0,
        completed: s === 2 && i % 4 === 0,
        updatedAt: 1_700_000_000_000 + i * 100 + s * 10,
        cwd: path,
      } as unknown as SessionSummary
    }

    workspaces.push({
      workspaceId: wsId,
      path,
      title,
      createdAt: new Date(1_700_000_000_000 + i * 1000).toISOString(),
      sessionIds: wsSessions,
    } as unknown as WorkspaceView)
  }

  const topLevelIds = workspaces
    .filter(w => manualAssignments[w.workspaceId] === null || (w.path.startsWith('/var/misc/random') && manualAssignments[w.workspaceId] === undefined))
    .map(w => w.workspaceId as string)

  const manual: ManualGroups = {
    categories: ['Custom Group', 'Archive'],
    assignments: manualAssignments,
    renamed: { Plugins: 'Plugin Extensions' },
    categoryOrder: ['Custom Group', 'Plugin Extensions', 'Docs', 'Core Projects'],
    workspaceOrder: {
      __topLevel__: [...topLevelIds].reverse(),
    },
  }

  const listState: SessionListState = {
    ids: sessionIds,
    byId: sessionById,
    current: 'session-0-1' as SessionId,
    phase: 'ready',
    subagentsByParent: {},
  } as unknown as SessionListState

  const view: GroupsTreeView = {
    expandedCategories: ['Custom Group', 'Plugin Extensions', 'Docs', 'Core Projects'],
    expandedWorkspaces: workspaces.map(w => w.workspaceId as string),
  }

  const searchResults = {
    items: [
      { sessionId: 'session-2-1' as SessionId, snippet: 'Matched plugin snippet 1' },
      { sessionId: 'session-7-1' as SessionId, snippet: 'Matched plugin snippet 2' },
    ],
    hasMore: false,
  }

  return {
    scale,
    workspaces,
    listState,
    config,
    manual,
    view,
    archivedSessionIds,
    searchQuery: 'Plugin',
    searchResults,
    searchLimit: 50,
    expectedCategoryCounts: {
      'Custom Group': expectedCustom,
      'Plugin Extensions': expectedPlugins,
      Docs: expectedDocs,
      'Core Projects': expectedCoreProjects,
      Archive: 0,
    },
    expectedTopLevelCount: expectedTopLevel,
    expectedTotalSessions: totalSessions,
  }
}
