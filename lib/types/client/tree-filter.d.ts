/**
 * Pure filtering model for sidebar tree views (categories and workspaces).
 * Filters sessions by status, recency, and color preset tags, returning
 * filtered category and top-level workspace nodes alongside aggregated status counts.
 */
import { DEFAULT_SIDEBAR_FILTER, type ColorPreset, type RecencyScope, type SidebarFilterPreferences, type StatusScope } from '../core/types.js';
import { type CategoryNode, type WorkspaceGroupNode } from './tree.js';
export { DEFAULT_SIDEBAR_FILTER };
export type { ColorPreset, RecencyScope, StatusScope };
export type SidebarFilter = SidebarFilterPreferences;
export interface FilterCounts {
    all: number;
    warning: number;
    ongoing: number;
    done: number;
}
export declare function sidebarFilterActive(filter: SidebarFilter): boolean;
export declare function applySidebarFilter(categories: readonly CategoryNode[], topLevel: readonly WorkspaceGroupNode[], filter: SidebarFilter, colors: Record<string, string | null> | undefined, now: number): {
    categories: CategoryNode[];
    topLevel: WorkspaceGroupNode[];
    counts: FilterCounts;
};
