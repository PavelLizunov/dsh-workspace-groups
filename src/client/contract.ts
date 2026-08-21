/**
 * Registrant-private injected share for the workspace-groups browser entry.
 * Mirrors the official ui-workspace browser inject (same runtime calls), with
 * two differences: no directory-flow hole dependency (Add Workspace is
 * self-contained via `pickDirectory`), and no locale-keyed naming collision.
 */
import type {
  PropsHooks,
  PropsLocale,
  PropsRuntime,
  PropsStore,
} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the sidebar shell's SlotMap merge (sidebar.workspaces).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { HostDescriptionSource } from '@deepseek-ai/dsh-client-connection/client'
import type {
  SessionId,
  SessionSearchResultItem,
  WorkspaceId,
  WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { createGroupsViewStore } from './stores.ts'

/** Injected share (arrives via the register inject factory). */
export type GroupsBrowserInjected = {
  /** Start a New Session in a Workspace (reuse-or-create its blank session and open it). */
  startSession: (workspaceId?: WorkspaceId) => void
  /** Open a real Session. */
  open: (sessionId: SessionId) => void
  /** Search current visible conversation messages. */
  searchSessions: (query: string, signal: AbortSignal) => Promise<{
    items: readonly SessionSearchResultItem[]
    hasMore: boolean
  }>
  /** Maximum number of merged rows rendered for one search. */
  searchResultLimit: number
  /** Rename a Session (resolves on host acceptance). */
  renameSession: (sessionId: SessionId, title: string) => Promise<void>
  /** Fork a Session at its last completed turn and open the child. */
  forkSession: (sessionId: SessionId) => void
  /** Rename a Host Workspace (rejects on name conflict). */
  renameWorkspace: (workspaceId: WorkspaceId, title: string) => Promise<void>
  /** Delete only a Host Workspace registration; directory and Session logs remain. */
  deleteWorkspace: (workspaceId: WorkspaceId) => Promise<void>
  /** Reorder a Workspace in the durable registry display order (omitted anchor appends). */
  insertWorkspaceBefore: (workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId) => Promise<void>
  /** Archive a Session into the registry-global set (hidden from grouping surfaces). */
  archiveSession: (sessionId: SessionId) => Promise<void>
  /** Reorder a session inside its Workspace account. */
  insertSessionBefore: (workspaceId: WorkspaceId, sessionId: SessionId, beforeSessionId?: SessionId) => Promise<void>
  /** Adopt a picked host directory as a real Workspace before targeting a Session. */
  createWorkspace: (input: { path: string }) => Promise<WorkspaceView>
  /** Ask the local Host to open its native single-directory chooser (self-contained Add Workspace). */
  pickDirectory: () => Promise<string | null>
  /** Browser-private injected hooks (host description; bound by the slot renderer). */
  hooks: {
    /** Current generation's Host description. */
    hostDescription: HostDescriptionSource
  }
}

/** Full browser props: shell owner share + viewing store + injected actions + locale seat. */
export type GroupsBrowserProps = PropsRuntime<'sidebar.workspaces'> &
  PropsStore<ReturnType<typeof createGroupsViewStore>> &
  Omit<GroupsBrowserInjected, 'hooks'> &
  PropsHooks<GroupsBrowserInjected['hooks']> &
  PropsLocale<'workspaceGroups'>
