/**
 * Registrant-private injected share for the workspace-groups browser entry.
 * Mirrors the official ui-workspace browser inject (same runtime calls), with
 * two differences: this plugin owns its in-app browse dialog while reusing
 * the official workspace service APIs (does not claim the official child hole),
 * and no locale-keyed naming collision.
 */
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { DirectoryListing } from '@deepseek-ai/dsh-api-remotes/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionSearchResultItem } from '@deepseek-ai/dsh-api-session-controller/client';
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { createGroupsViewStore } from './stores.js';
/** Injected share (arrives via the register inject factory). */
export type GroupsBrowserInjected = {
    /** Start a New Session in a Workspace (reuse-or-create its blank session and open it). */
    startSession: (workspaceId?: WorkspaceId) => void;
    /** Open a real Session. */
    open: (sessionId: SessionId) => void;
    /** Search current visible conversation messages. */
    searchSessions: (query: string, signal: AbortSignal) => Promise<{
        items: readonly SessionSearchResultItem[];
        hasMore: boolean;
    }>;
    /** Maximum number of merged rows rendered for one search. */
    searchResultLimit: number;
    /** Rename a Session (resolves on host acceptance). */
    renameSession: (sessionId: SessionId, title: string) => Promise<void>;
    /** Fork a Session at its last completed turn and open the child. */
    forkSession: (sessionId: SessionId) => Promise<void>;
    /** Rename a Host Workspace (rejects on name conflict). */
    renameWorkspace: (workspaceId: WorkspaceId, title: string) => Promise<void>;
    /** Delete only a Host Workspace registration; directory and Session logs remain. */
    deleteWorkspace: (workspaceId: WorkspaceId) => Promise<void>;
    /** Reorder a Workspace in the durable registry display order (omitted anchor appends). */
    insertWorkspaceBefore: (workspaceId: WorkspaceId, beforeWorkspaceId?: WorkspaceId) => Promise<void>;
    /** Archive a Session into the registry-global set (hidden from grouping surfaces). */
    archiveSession: (sessionId: SessionId) => Promise<void>;
    /** Recheck live eligibility and workspace scope immediately before each cleanup archive. */
    cleanupSessions: (sessionIds: readonly SessionId[], days: number, workspaceId?: WorkspaceId) => Promise<void>;
    /** Reorder a session inside its Workspace account. */
    insertSessionBefore: (workspaceId: WorkspaceId, sessionId: SessionId, beforeSessionId?: SessionId) => Promise<void>;
    /** Adopt a picked host directory as a real Workspace before targeting a Session. */
    createWorkspace: (input: {
        path: string;
    }) => Promise<WorkspaceView>;
    /** List one directory level through the Host's `browse` capability. */
    listDirectory: (path?: string, signal?: AbortSignal) => Promise<DirectoryListing>;
    /** Create one child directory through the Host's `browse` capability. */
    createDirectory: (path: string, name: string) => Promise<string>;
};
/** Full browser props: shell owner share + viewing store + injected actions + locale seat. */
export type GroupsBrowserProps = PropsRuntime<'sidebar.workspaces'> & PropsStore<ReturnType<typeof createGroupsViewStore>> & GroupsBrowserInjected & PropsLocale<'workspaceGroups'>;
