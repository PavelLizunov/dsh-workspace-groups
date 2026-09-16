/**
 * Row components for the workspace-groups tree. Kept dependency-light: they
 * consume only React, primitives (StateDot/Menu/icons), and the shared CSS
 * string. Each row owns its hover actions menu; dialogs live in the browser
 * root so they survive row unmounts during collapse.
 *
 * Drag & drop: workspace rows are draggable sources; category rows (and
 * workspace rows, standing for their containing category) are drop targets.
 * The payload is a custom dataTransfer type so only in-plugin drags land.
 */
import { type DragEvent } from 'react';
import { type RowDropProps, type T, type WorkspaceMoveTarget } from './row-utils.js';
import type { CategoryNode, SessionNode, WorkspaceGroupNode } from './tree.js';
export * from './row-utils.js';
export { ColorMenu } from './ColorMenu.tsx';
export type { ColorMenuProps } from './ColorMenu.tsx';
export interface CategoryRowProps extends RowDropProps {
    node: CategoryNode;
    t: T;
    /** Omit for fixed-expanded, non-toggleable search branches. */
    onToggle?: () => void;
    onExpandEntire?: (() => void) | undefined;
    onCollapseEntire?: (() => void) | undefined;
    onAddWorkspace?: (() => void) | undefined;
    /** Rename/delete actions; the hover menu renders only when both provided. */
    onRename?: () => void;
    onDelete?: () => void;
    color?: string | null | undefined;
    onSetColor?: ((color: string | null) => void) | undefined;
    /** Group reorder source; the row becomes draggable only when provided. */
    onDragStartCategory?: (event: DragEvent) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    isFirst?: boolean;
    isLast?: boolean;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    'aria-level'?: number;
    'aria-posinset'?: number;
    'aria-setsize'?: number;
}
/**
 * One category folder row: toggle, rename/delete menu (every group — rule
 * groups via overlay renames/hides), draggable source for group reorder and
 * drop target for both workspace moves and group reorders.
 */
export declare function CategoryRow({ node, t, onToggle, onExpandEntire, onCollapseEntire, onAddWorkspace, onRename, onDelete, color, onSetColor, dropActive, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartCategory, onMoveUp, onMoveDown, isFirst, isLast, canMoveUp, canMoveDown, 'aria-level': ariaLevel, 'aria-posinset': ariaPosinset, 'aria-setsize': ariaSetsize, }: CategoryRowProps): import("react").JSX.Element;
export interface WorkspaceRowProps extends RowDropProps {
    node: WorkspaceGroupNode;
    t: T;
    /** Omit for fixed-expanded, non-toggleable search branches. */
    onToggle?: () => void;
    onNewSession?: () => void;
    onRename?: () => void;
    onDelete?: () => void;
    onCleanup?: (() => void) | undefined;
    color?: string | null | undefined;
    onSetColor?: ((color: string | null) => void) | undefined;
    /** Project currently sits inside a group — offer "move out of group". */
    canMoveOut?: boolean;
    onMoveOut?: () => void;
    /** All group/top-level destinations for the Move to group submenu. */
    moveTargets?: readonly WorkspaceMoveTarget[];
    onMoveTo?: (categoryKey: string) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onOpenFolder?: () => void;
    onCopyPath?: () => void;
    isFirst?: boolean;
    isLast?: boolean;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    /** Render as a top-level row (no folder indentation). */
    flat?: boolean;
    /** Explicitly enable this Workspace row as a drag source. */
    draggable?: boolean;
    /** Notify the browser after this row has populated the Workspace drag payload. */
    onWorkspaceDragStart?: (workspaceId: WorkspaceGroupNode['workspaceId'], event: DragEvent) => void;
    'aria-level'?: number;
    'aria-posinset'?: number;
    'aria-setsize'?: number;
}
/** One workspace folder row inside a category: draggable source + drop target. */
export declare function WorkspaceRow({ node, t, onToggle, onNewSession, onRename, onDelete, onCleanup, color, onSetColor, canMoveOut, onMoveOut, moveTargets, onMoveTo, onMoveUp, onMoveDown, onOpenFolder, onCopyPath, isFirst, isLast, canMoveUp, canMoveDown, flat, draggable, dropActive, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onWorkspaceDragStart, 'aria-level': ariaLevel, 'aria-posinset': ariaPosinset, 'aria-setsize': ariaSetsize, }: WorkspaceRowProps): import("react").JSX.Element;
export interface SessionRowProps {
    node: SessionNode;
    currentId: string | undefined;
    now: number;
    t: T;
    onOpen: (id: SessionNode['id']) => void;
    onRename?: (id: SessionNode['id'], currentTitle: string) => void;
    onFork?: (id: SessionNode['id']) => void;
    onArchive?: (id: SessionNode['id']) => void;
    onPinToggle?: ((id: SessionNode['id']) => void) | undefined;
    color?: string | null | undefined;
    onSetColor?: ((color: string | null) => void) | undefined;
    actionBusy?: boolean;
    'aria-level'?: number;
    'aria-posinset'?: number;
    'aria-setsize'?: number;
}
export declare function IconPin16({ size, className }: {
    size?: number;
    className?: string;
}): import("react").JSX.Element;
export declare function IconPinOff16({ size, className }: {
    size?: number;
    className?: string;
}): import("react").JSX.Element;
/** One session leaf row. */
export declare function SessionRow({ node, currentId, now, t, onOpen, onRename, onFork, onArchive, onPinToggle, color, onSetColor, actionBusy, 'aria-level': ariaLevel, 'aria-posinset': ariaPosinset, 'aria-setsize': ariaSetsize, }: SessionRowProps): import("react").JSX.Element;
export type { T };
