import { type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { CategoryNode, SessionNode, WorkspaceGroupNode } from './tree.ts';
type T = TranslateNS<'workspaceGroups'>;
/** Primary status dot state for a session row. */
export declare function sessionDotState(node: Pick<SessionNode, 'pendingInteraction' | 'running' | 'runningSubagentCount' | 'completed'>): StateDotState;
/** Compact relative time ("now"/"5min"/"3h"/"2d"/"4mo"/"1y"). */
export declare function relativeTimeLabel(updatedAt: number, now: number): string;
/** One category folder row. */
export declare function CategoryRow({ node, t, onToggle }: {
    node: CategoryNode;
    t: T;
    onToggle: () => void;
}): import("react").JSX.Element;
/** One workspace folder row inside a category. */
export declare function WorkspaceRow({ node, t, onToggle, onNewSession, onRename, onDelete }: {
    node: WorkspaceGroupNode;
    t: T;
    onToggle: () => void;
    onNewSession: () => void;
    onRename: () => void;
    onDelete: () => void;
}): import("react").JSX.Element;
/** One session leaf row. */
export declare function SessionRow({ node, currentId, now, t, onOpen, onRename, onFork, onArchive }: {
    node: SessionNode;
    currentId: string | undefined;
    now: number;
    t: T;
    onOpen: (id: SessionNode['id']) => void;
    onRename: (id: SessionNode['id'], currentTitle: string) => void;
    onFork: (id: SessionNode['id']) => void;
    onArchive: (id: SessionNode['id']) => void;
}): import("react").JSX.Element;
export type { T };
