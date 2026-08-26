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
import { useState, type DragEvent, type KeyboardEvent } from 'react'
import {
  IconArchiveOutline20,
  IconBranchOutline16,
  IconEditOutline16,
  IconEllipsisOutline16,
  IconFolderClose16,
  IconFolderOpen16,
  IconFolderOpenOutline16,
  IconPlusOutline16,
  IconProjectAddOutline16,
  IconTriangleRightFill14,
  IconTrashOutline16,
  Menu,
  StateDot,
  type StateDotState,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceGroupsKey } from './locales.ts'
import type { CategoryNode, SessionNode, WorkspaceGroupNode } from './tree.ts'

export interface WorkspaceMoveTarget {
  key: string
  label: string
  current: boolean
}

type T = TranslateNS<'workspaceGroups'>

/** dataTransfer type carrying the dragged workspace id (in-plugin drags only). */
export const DND_WORKSPACE_TYPE = 'application/x-dsh-workspace-groups'
/** dataTransfer type carrying the dragged category key (group reorder). */
export const DND_CATEGORY_TYPE = 'application/x-dsh-workspace-groups-category'

/** Whether a drag carries any of the plugin's payloads (drop targets accept both). */
export function hasPluginDragType(types: DOMStringList | readonly string[]): boolean {
  const list = Array.from(types as Iterable<string>)
  return list.includes(DND_WORKSPACE_TYPE) || list.includes(DND_CATEGORY_TYPE)
}

/** Pending interaction status → primitives StateDot state. */
function pendingState(status: SessionNode['pendingInteraction']): StateDotState | undefined {
  switch (status) {
    case 'approval':
    case 'plan-review':
    case 'question':
      return 'warning'
    default:
      return undefined
  }
}

/** Primary status dot state for a session row. */
export function sessionDotState(node: Pick<SessionNode, 'pendingInteraction' | 'running' | 'runningSubagentCount' | 'completed'>): StateDotState {
  if (pendingState(node.pendingInteraction) !== undefined) return 'warning'
  if (node.running || node.runningSubagentCount > 0) return 'ongoing'
  return node.completed ? 'done' : 'done'
}

/** Compact relative time ("now"/"5min"/"3h"/"2d"/"4mo"/"1y"). */
export function relativeTimeLabel(updatedAt: number, now: number): string {
  const diff = Math.max(0, now - updatedAt)
  const MIN = 60_000
  const HOUR = 3_600_000
  const DAY = 86_400_000
  if (diff < MIN) return 'now'
  if (diff < HOUR) return `${Math.floor(diff / MIN)}min`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d`
  if (diff < 365 * DAY) return `${Math.floor(diff / (30 * DAY))}mo`
  return `${Math.floor(diff / (365 * DAY))}y`
}

/** Drop-target props shared by category and workspace rows (all optional). */
export interface RowDropProps {
  /** Row is under the dragged workspace — show the drop highlight. */
  dropActive?: boolean
  /** Insertion indicator: a line above (before) or below (after) this row. */
  insertLine?: 'before' | 'after'
  /** Accept a drag over this row (must preventDefault to allow the drop). */
  onRowDragOver?: (event: DragEvent) => void
  /** Clear the highlight when the pointer leaves the row. */
  onRowDragLeave?: (event: DragEvent) => void
  /** Drop a workspace onto this row. */
  onRowDrop?: (event: DragEvent) => void
}

/**
 * One category folder row: toggle, rename/delete menu (every group — rule
 * groups via overlay renames/hides), draggable source for group reorder and
 * drop target for both workspace moves and group reorders.
 */
export function CategoryRow({ node, t, onToggle, onRename, onDelete, dropActive = false, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartCategory, onMoveUp, onMoveDown, isFirst, isLast, canMoveUp, canMoveDown, 'aria-level': ariaLevel, 'aria-posinset': ariaPosinset, 'aria-setsize': ariaSetsize }: {
  node: CategoryNode
  t: T
  /** Omit for fixed-expanded, non-toggleable search branches. */
  onToggle?: () => void
  /** Rename/delete actions; the hover menu renders only when both provided. */
  onRename?: () => void
  onDelete?: () => void
  /** Group reorder source; the row becomes draggable only when provided. */
  onDragStartCategory?: (event: DragEvent) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  isFirst?: boolean
  isLast?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
  'aria-level'?: number
  'aria-posinset'?: number
  'aria-setsize'?: number
} & RowDropProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const count = node.workspaces.length
  const manageable = onRename !== undefined && onDelete !== undefined
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (onToggle === undefined || event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onToggle()
  }
  return (
    <div
      className={`wgCategoryRow${menuOpen ? ' wgMenuOpen' : ''}${dropActive ? ' wgDropTarget' : ''}${insertLine === 'before' ? ' wgInsertBefore' : insertLine === 'after' ? ' wgInsertAfter' : ''}`}
      role="treeitem"
      tabIndex={0}
      aria-expanded={node.expanded}
      aria-label={`${node.label} (${count})`}
      aria-level={ariaLevel}
      aria-posinset={ariaPosinset}
      aria-setsize={ariaSetsize}
      data-wg-category={node.key}
      onClick={onToggle}
      onKeyDown={onToggle === undefined ? undefined : handleKeyDown}
      onDragOver={onRowDragOver}
      onDragLeave={onRowDragLeave}
      onDrop={onRowDrop}
    >
      <span className={`wgChevron${node.expanded ? ' wgChevronOpen' : ''}`}>
        <IconTriangleRightFill14 />
      </span>
      <span className="wgCategoryIcon" data-wg-row-icon="group">
        {node.expanded ? <IconFolderOpen16 /> : <IconFolderClose16 />}
      </span>
      <span className="wgCategoryLabel">{node.label}</span>
      <span className="wgCategoryCount">{count}</span>
      {(manageable || onDragStartCategory !== undefined) && (
        <span className="wgRowActions">
          {onDragStartCategory !== undefined && (
            <span
              role="button"
              tabIndex={0}
              className="wgDragHandle"
              data-wg-drag-handle="category"
              draggable
              aria-label={t('group.reorder')}
              title={t('group.reorder')}
              onDragStart={onDragStartCategory}
              onClick={(e) => { e.stopPropagation() }}
              onDoubleClick={(e) => { e.stopPropagation() }}
              onKeyDown={(e) => { e.stopPropagation() }}
            >
              <span className="wgGripIcon" aria-hidden="true" />
            </span>
          )}
          {manageable && (
            <Menu
              open={menuOpen}
              onClose={() => { setMenuOpen(false) }}
              items={[
                ...(onMoveUp !== undefined ? [{ id: 'moveUp', label: t('group.moveUp'), disabled: canMoveUp === false || isFirst === true }] : []),
                ...(onMoveDown !== undefined ? [{ id: 'moveDown', label: t('group.moveDown'), disabled: canMoveDown === false || isLast === true }] : []),
                { id: 'rename', label: t('group.rename'), icon: <IconEditOutline16 /> },
                { id: 'delete', label: t('group.delete'), icon: <IconTrashOutline16 />, danger: true },
              ]}
              onSelect={(id) => {
                setMenuOpen(false)
                if (id === 'moveUp') onMoveUp?.()
                if (id === 'moveDown') onMoveDown?.()
                if (id === 'rename') onRename?.()
                if (id === 'delete') onDelete?.()
              }}
              portal
              closeOnPointerLeave
              anchor={(
                <button
                  type="button"
                  className="wgIconButton"
                  draggable={false}
                  aria-label={`${t('group.actions')}: ${node.label}`}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
                  onKeyDown={(e) => { e.stopPropagation() }}
                >
                  <IconEllipsisOutline16 />
                </button>
              )}
            />
          )}
        </span>
      )}
    </div>
  )
}

/** One workspace folder row inside a category: draggable source + drop target. */
export function WorkspaceRow({ node, t, onToggle, onNewSession, onRename, onDelete, canMoveOut = false, onMoveOut, moveTargets, onMoveTo, onMoveUp, onMoveDown, onOpenFolder, onCopyPath, isFirst, isLast, canMoveUp, canMoveDown, flat = false, dropActive = false, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartExtra, 'aria-level': ariaLevel, 'aria-posinset': ariaPosinset, 'aria-setsize': ariaSetsize }: {
  node: WorkspaceGroupNode
  t: T
  /** Omit for fixed-expanded, non-toggleable search branches. */
  onToggle?: () => void
  onNewSession?: () => void
  onRename?: () => void
  onDelete?: () => void
  /** Project currently sits inside a group — offer "move out of group". */
  canMoveOut?: boolean
  onMoveOut?: () => void
  /** All group/top-level destinations for the Move to group submenu. */
  moveTargets?: readonly WorkspaceMoveTarget[]
  onMoveTo?: (categoryKey: string) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onOpenFolder?: () => void
  onCopyPath?: () => void
  isFirst?: boolean
  isLast?: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
  /** Render as a top-level row (no folder indentation). */
  flat?: boolean
  /** Extra dragstart hook (e.g. collapse all expanded projects while dragging). */
  onDragStartExtra?: () => void
  'aria-level'?: number
  'aria-posinset'?: number
  'aria-setsize'?: number
} & RowDropProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const manageable = onRename !== undefined && onDelete !== undefined
  const menuItems = [
    ...(onMoveUp !== undefined ? [{ id: 'moveUp', label: t('workspace.moveUp'), disabled: canMoveUp === false || isFirst === true }] : []),
    ...(onMoveDown !== undefined ? [{ id: 'moveDown', label: t('workspace.moveDown'), disabled: canMoveDown === false || isLast === true }] : []),
    ...(moveTargets !== undefined && onMoveTo !== undefined
      ? [{
          id: 'moveToGroup',
          label: t('workspace.moveToGroup'),
          icon: <IconFolderOpenOutline16 size={16} />,
          submenu: moveTargets.map(target => ({
            id: `moveTo:${target.key}`,
            label: target.label,
            disabled: target.current,
          })),
        }]
      : canMoveOut && onMoveOut !== undefined
        ? [{ id: 'moveOut', label: t('workspace.moveOutOfGroup'), icon: <IconFolderOpenOutline16 size={16} /> }]
        : []),
    ...(onOpenFolder !== undefined ? [{ id: 'openFolder', label: t('workspace.openFolder'), icon: <IconFolderOpen16 size={16} /> }] : []),
    ...(onCopyPath !== undefined ? [{ id: 'copyPath', label: t('workspace.copyPath'), icon: <IconEditOutline16 size={16} /> }] : []),
    ...(onRename !== undefined ? [{ id: 'rename', label: t('workspace.rename'), icon: <IconEditOutline16 /> }] : []),
    ...(onDelete !== undefined ? [{ id: 'delete', label: t('workspace.delete'), icon: <IconTrashOutline16 />, danger: true }] : []),
  ]
  const onDragStart = (event: DragEvent): void => {
    event.dataTransfer.setData(DND_WORKSPACE_TYPE, node.workspaceId)
    event.dataTransfer.effectAllowed = 'move'
    onDragStartExtra?.()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onToggle?.()
  }
  return (
    <div
      className={`wgProjectRow${node.containsCurrent ? ' wgProjectActive' : ''}${flat ? ' wgProjectFlat' : ''}${menuOpen ? ' wgMenuOpen' : ''}${dropActive ? ' wgDropTarget' : ''}${insertLine === 'before' ? ' wgInsertBefore' : insertLine === 'after' ? ' wgInsertAfter' : ''}`}
      role="treeitem"
      tabIndex={0}
      aria-expanded={node.expanded}
      aria-label={node.label}
      aria-level={ariaLevel}
      aria-posinset={ariaPosinset}
      aria-setsize={ariaSetsize}
      data-wsid={node.workspaceId}
      draggable={onDragStartExtra !== undefined || onRowDrop !== undefined}
      onClick={onToggle}
      onKeyDown={onToggle === undefined ? undefined : handleKeyDown}
      onDragStart={onDragStartExtra !== undefined || onRowDrop !== undefined ? onDragStart : undefined}
      onDragOver={onRowDragOver}
      onDragLeave={onRowDragLeave}
      onDrop={onRowDrop}
    >
      <span className={`wgChevron${node.expanded ? ' wgChevronOpen' : ''}`}>
        <IconTriangleRightFill14 />
      </span>
      <span className="wgCategoryIcon" data-wg-row-icon="project">
        {/* Project rows use the project glyph (same as the official workspace
            browser) so groups (folder glyph) and projects stay distinguishable. */}
        <IconProjectAddOutline16 />
      </span>
      <span className="wgProjectLabel" title={node.path}>{node.label}</span>
      {(menuItems.length > 0 || onNewSession !== undefined) && <span className="wgRowActions">
        {menuItems.length > 0 && <Menu
          open={menuOpen}
          onClose={() => { setMenuOpen(false) }}
          items={menuItems}
          onSelect={(id) => {
            setMenuOpen(false)
            if (id === 'moveUp') onMoveUp?.()
            if (id === 'moveDown') onMoveDown?.()
            if (id === 'openFolder') onOpenFolder?.()
            if (id === 'copyPath') onCopyPath?.()
            if (id === 'moveOut') onMoveOut?.()
            if (id.startsWith('moveTo:')) onMoveTo?.(id.slice('moveTo:'.length))
            if (id === 'rename') onRename?.()
            if (id === 'delete') onDelete?.()
          }}
          portal
          closeOnPointerLeave
          anchor={(
            <button
              type="button"
              className="wgIconButton"
              draggable={false}
              aria-label={`${t('workspace.actions')}: ${node.label}`}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
              onKeyDown={(e) => { e.stopPropagation() }}
            >
              <IconEllipsisOutline16 />
            </button>
          )}
        />}
        {onNewSession !== undefined && <button
          type="button"
          className="wgIconButton"
          draggable={false}
          aria-label={`${t('session.new')} ${node.label}`}
          onClick={(e) => { e.stopPropagation(); onNewSession() }}
          onKeyDown={(e) => { e.stopPropagation() }}
        >
          <IconPlusOutline16 />
        </button>}
      </span>}
    </div>
  )
}

/** One session leaf row. */
export function SessionRow({ node, currentId, now, t, onOpen, onRename, onFork, onArchive, actionBusy = false, 'aria-level': ariaLevel, 'aria-posinset': ariaPosinset, 'aria-setsize': ariaSetsize }: {
  node: SessionNode
  currentId: string | undefined
  now: number
  t: T
  onOpen: (id: SessionNode['id']) => void
  onRename?: (id: SessionNode['id'], currentTitle: string) => void
  onFork?: (id: SessionNode['id']) => void
  onArchive?: (id: SessionNode['id']) => void
  actionBusy?: boolean
  'aria-level'?: number
  'aria-posinset'?: number
  'aria-setsize'?: number
}) {
  const selected = node.id === currentId
  const [menuOpen, setMenuOpen] = useState(false)
  const showStatus = true
  const menuItems = [
    ...(onRename !== undefined ? [{ id: 'rename', label: t('session.rename'), icon: <IconEditOutline16 /> }] : []),
    ...(onFork !== undefined ? [{ id: 'fork', label: t('session.fork'), icon: <IconBranchOutline16 />, disabled: actionBusy }] : []),
    ...(onArchive !== undefined ? [{ id: 'archive', label: t('session.archive'), icon: <IconArchiveOutline20 size={16} />, disabled: actionBusy }] : []),
  ]
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpen(node.id)
  }
  return (
    <div
      className={`wgSessionRow${selected ? ' wgSelected' : ''}${menuOpen ? ' wgMenuOpen' : ''}${node.matched === true ? ' wgMatched' : ''}`}
      role="treeitem"
      tabIndex={0}
      aria-selected={selected}
      aria-current={selected ? 'true' : undefined}
      aria-label={node.title}
      aria-level={ariaLevel}
      aria-posinset={ariaPosinset}
      aria-setsize={ariaSetsize}
      onClick={() => { onOpen(node.id) }}
      onKeyDown={handleKeyDown}
    >
      <span className="wgStatusSlot">
        {showStatus && <StateDot state={sessionDotState(node)} />}
      </span>
      <span className="wgSessionTitle">{node.title}</span>
      {!node.blank && <span className="wgSessionTime">{relativeTimeLabel(node.updatedAt, now)}</span>}
      {node.snippet !== undefined && (
        <span className="wgSessionSnippet" title={node.snippet}>{node.snippet}</span>
      )}
      {!node.blank && menuItems.length > 0 && (
        <span className="wgRowActions">
          <Menu
            open={menuOpen}
            onClose={() => { setMenuOpen(false) }}
            items={menuItems}
            onSelect={(id) => {
              setMenuOpen(false)
              if (id === 'rename') onRename?.(node.id, node.title)
              if (id === 'fork') onFork?.(node.id)
              if (id === 'archive') onArchive?.(node.id)
            }}
            portal
            closeOnPointerLeave
            anchor={(
              <button
                type="button"
                className="wgIconButton"
                aria-label={`${t('session.actions')}: ${node.title}`}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
                onKeyDown={(e) => { e.stopPropagation() }}
              >
                <IconEllipsisOutline16 />
              </button>
            )}
          />
        </span>
      )}
    </div>
  )
}

export type { T }
