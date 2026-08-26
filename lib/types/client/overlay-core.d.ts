/**
 * Pure overlay hygiene mutations for ManualGroups overlay management.
 * Kept free of React or runtime state bindings so both client UI actions
 * and unit tests share a single immutable implementation.
 */
import { type ManualGroups } from '../core/types.js';
export interface MoveWorkspaceParams {
    workspaceId: string;
    targetCategoryKey: string | null;
    beforeId?: string | undefined;
    afterId?: string | undefined;
    targetMembers?: readonly string[] | undefined;
}
export interface RemoveGroupOptions {
    originalRuleName?: string;
}
export interface RenameGroupOptions {
    originalRuleName?: string;
}
/**
 * Remove a deleted group from the overlay:
 * - Removes matching category entries from `categories` and `categoryOrder`.
 * - Sets matching assignments to `null` (uncategorized), including orphan workspace IDs.
 * - Deletes the group's entry in `workspaceOrder`.
 * - For rule groups (when `originalRuleName` is supplied), updates `renamed` and `hidden`.
 */
export declare function removeGroup(manual: ManualGroups, groupName: string, options?: RemoveGroupOptions): ManualGroups;
/**
 * Remove all references to a deleted Workspace from assignments and all workspaceOrder arrays.
 */
export declare function removeWorkspace(manual: ManualGroups, workspaceId: string): ManualGroups;
/**
 * Move a Workspace across groups or top-level, cleaning stale order references from all other order arrays.
 * Accepts positional arguments or a params object for parameters.
 */
export declare function moveWorkspace(manual: ManualGroups, params: MoveWorkspaceParams): ManualGroups;
/**
 * Rename group references consistently across categories, categoryOrder, assignments, workspaceOrder, and renamed.
 */
export declare function renameGroup(manual: ManualGroups, oldName: string, newName: string, options?: RenameGroupOptions): ManualGroups;
