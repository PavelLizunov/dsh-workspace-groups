/**
 * Drag-and-drop constants, time formatting, and status indicators shared across tree rows.
 */
import type { DragEvent } from 'react';
import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { type SessionNode } from './tree.js';
export type T = TranslateNS<'workspaceGroups'>;
export interface WorkspaceMoveTarget {
    key: string;
    label: string;
    current: boolean;
}
/** dataTransfer type carrying the dragged workspace id (in-plugin drags only). */
export declare const DND_WORKSPACE_TYPE = "application/x-dsh-workspace-groups";
/** dataTransfer type carrying the dragged category key (group reorder). */
export declare const DND_CATEGORY_TYPE = "application/x-dsh-workspace-groups-category";
/** Whether a drag carries any of the plugin's payloads (drop targets accept both). */
export declare function hasPluginDragType(types: DOMStringList | readonly string[]): boolean;
/** Primary status dot state for a session row; idle viewed sessions have no dot. */
export declare function sessionDotState(node: Pick<SessionNode, 'pendingInteraction' | 'running' | 'runningSubagentCount' | 'completed' | 'projectionReason'>): StateDotState | undefined;
/** Compact relative time ("now"/"5min"/"3h"/"2d"/"4mo"/"1y"). */
export declare function relativeTimeLabel(updatedAt: number, now: number): string;
/** Drop-target props shared by category and workspace rows (all optional). */
export interface RowDropProps {
    /** Row is under the dragged workspace — show the drop highlight. */
    dropActive?: boolean;
    /** Insertion indicator: a line above (before) or below (after) this row. */
    insertLine?: 'before' | 'after';
    /** Accept a drag over this row (must preventDefault to allow the drop). */
    onRowDragOver?: (event: DragEvent) => void;
    /** Clear the highlight when the pointer leaves the row. */
    onRowDragLeave?: (event: DragEvent) => void;
    /** Drop a workspace onto this row. */
    onRowDrop?: (event: DragEvent) => void;
}
export declare const COLOR_PRESETS: readonly ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink"];
