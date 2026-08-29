/**
 * Pure filtering model for sidebar tree views (categories and workspaces).
 * Filters sessions by status, recency, and color preset tags, returning
 * filtered category and top-level workspace nodes alongside aggregated status counts.
 */
import { type CategoryNode, type WorkspaceGroupNode } from './tree.js';
export type ColorPreset = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink';
export type StatusScope = 'all' | 'warning' | 'ongoing' | 'done';
export type RecencyScope = 'all' | '24h' | '7d' | '30d';
export interface SidebarFilter {
    status: StatusScope;
    recency: RecencyScope;
    color: ColorPreset | null;
}
export interface FilterCounts {
    all: number;
    warning: number;
    ongoing: number;
    done: number;
}
export declare const DEFAULT_SIDEBAR_FILTER: SidebarFilter;
export declare function sidebarFilterActive(filter: SidebarFilter): boolean;
export declare function applySidebarFilter(categories: readonly CategoryNode[], topLevel: readonly WorkspaceGroupNode[], filter: SidebarFilter, colors: Record<string, string | null> | undefined, now: number): {
    categories: CategoryNode[];
    topLevel: WorkspaceGroupNode[];
    counts: FilterCounts;
};
