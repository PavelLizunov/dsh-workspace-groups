import type { GroupsBrowserProps } from './contract.ts';
/**
 * Render the browsing region.
 * @param props - composed slot props (shell owner share + store + injected actions).
 * @returns the region element tree.
 */
export declare function GroupsBrowser({ wide, expandSidebar, useSessions, useWorkspaces, useStore, actions, startSession, open, renameSession, forkSession, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, archiveSession, insertSessionBefore, createWorkspace, pickDirectory, searchSessions, searchResultLimit, t, }: GroupsBrowserProps): import("react").JSX.Element;
