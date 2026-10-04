import { type ScopeOption } from './ScopeFilter.tsx';
import type { T } from './row-utils.js';
export interface WorkspaceChoice extends ScopeOption {
    groupKey: string;
}
/** Two levels in one anchored popup; drilling is not selection or navigation. */
export declare function WorkspaceNavigator({ groups, workspaces, groupKey, workspaceId, onScope, onNavigate, t }: {
    groups: readonly ScopeOption[];
    workspaces: readonly WorkspaceChoice[];
    groupKey: string;
    workspaceId: string;
    onScope: (groupKey: string, workspaceId: string) => void;
    onNavigate: (workspace: WorkspaceChoice) => Promise<void>;
    t: T;
}): import("react").JSX.Element;
