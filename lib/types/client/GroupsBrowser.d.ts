import type { GroupsBrowserProps } from './contract.js';
/** Row reference used by drop targets: which kind of row, which key. */
export type DropRowRef = {
    kind: 'category' | 'workspace' | 'topLevel';
    key: string;
};
/** Which payload level is currently dragging; expansion remains unchanged. */
export type DragLevel = 'workspace' | 'category' | null;
/**
 * Current drop indicator. A `line` renders a 2px insertion line above/below a
 * row (project reorder inside a group, or group reorder); an `into` renders
 * the whole-row highlight used when dropping a project into a group. Drop
 * handlers re-derive before/after from the drop event itself, so the
 * indicator is purely visual and can never go stale.
 */
export type DragIndicator = {
    mode: 'line';
    row: DropRowRef;
    before: boolean;
} | {
    mode: 'into';
    categoryKey: string;
} | null;
/**
 * Render the browsing region.
 * @param props - composed slot props (shell owner share + store + injected actions).
 * @returns the region element tree.
 */
export declare function GroupsBrowser({ wide, expandSidebar, useSessions, useWorkspaces, useStore, actions, startSession, open, renameSession, forkSession, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, archiveSession, insertSessionBefore, createWorkspace, listDirectory, createDirectory, searchSessions, searchResultLimit, t, }: GroupsBrowserProps): import("react").JSX.Element;
