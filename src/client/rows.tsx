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
import { FILTER_COLOR_PRESETS } from '../core/types.ts'
import type { WorkspaceGroupsKey } from './locales.ts'
import { sessionAttention, type CategoryNode, type SessionNode, type WorkspaceGroupNode } from './tree.ts'

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

/** Primary status dot state for a session row; idle viewed sessions have no dot. */
export function sessionDotState(node: Pick<SessionNode, 'pendingInteraction' | 'running' | 'runningSubagentCount' | 'completed' | 'projectionReason'>): StateDotState | undefined {
  return sessionAttention(node)
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

export const COLOR_PRESETS = FILTER_COLOR_PRESETS

/** Flat portal menu: unlike nested submenus, Menu clamps this list to the viewport. */
function ColorMenu({ t, color, onSelect }: {
  t: T
  color?: string | null | undefined
  onSelect: (color: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={[
        { id: 'color:none', label: t('color.reset') },
        ...COLOR_PRESETS.map(preset => ({ id: `color:${preset}`, label: t(`color.${preset}` as keyof T) })),
      ]}
      selectedId={`color:${color ?? 'none'}`}
      onSelect={(id) => {
        setOpen(false)
        const selected = id.slice('color:'.length)
        onSelect(selected === 'none' ? null : selected)
      }}
      portal
      compact
      closeOnPointerLeave
      align="end"
      anchor={(
        <button
          type="button"
          className="wgIconButton"
          draggable={false}
          data-wg-color-menu-trigger
          aria-label={t('color.title')}
          title={t('color.title')}
          onClick={(event) => { event.stopPropagation(); setOpen(value => !value) }}
          onKeyDown={(event) => { event.stopPropagation() }}
        >
          <span className="wgCategoryIcon">
            <IconEditOutline16 />
            {color && <span className="wgColorDot" data-color={color} />}
          </span>
        </button>
      )}
    />
  )
}

/**
 * One category folder row: toggle, rename/delete menu (every group — rule
 * groups via overlay renames/hides), draggable source for group reorder and
 * drop target for both workspace moves and group reorders.
 */
export function CategoryRow({ node, t, onToggle, onExpandEntire, onCollapseEntire, onRename, onDelete, color, onSetColor, dropActive = false, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartCategory, onMoveUp, onMoveDown, isFirst, isLast, canMoveUp, canMoveDown, 'aria-level': ariaLevel, 'aria-posinset': ariaPosinset, 'aria-setsize': ariaSetsize }: {
  node: CategoryNode
  t: T
  /** Omit for fixed-expanded, non-toggleable search branches. */
  onToggle?: () => void
  onExpandEntire?: (() => void) | undefined
  onCollapseEntire?: (() => void) | undefined
  /** Rename/delete actions; the hover menu renders only when both provided. */
  onRename?: () => void
  onDelete?: () => void
  color?: string | null | undefined
  onSetColor?: ((color: string | null) => void) | undefined
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
  const manageable = (onRename !== undefined && onDelete !== undefined) || onExpandEntire !== undefined || onCollapseEntire !== undefined
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
      <span
        className={`wgChevron${node.expanded ? ' wgChevronOpen' : ''}`}
        onClick={(event) => {
          if (!event.altKey) return
          const toggleEntire = node.expanded ? onCollapseEntire : onExpandEntire
          if (toggleEntire === undefined) return
          event.stopPropagation()
          toggleEntire()
        }}
      >
        <IconTriangleRightFill14 />
      </span>
      <span className="wgCategoryIcon" data-wg-row-icon="group">
        {node.expanded ? <IconFolderOpen16 /> : <IconFolderClose16 />}
        {color && <span className="wgColorDot" data-color={color} />}
      </span>
      <span className="wgCategoryLabel">{node.label}</span>
      <span className="wgCategoryCount">{count}</span>
      {!node.expanded && node.attention !== undefined && (
        <span className="wgStatusSlot">
          <StateDot state={node.attention} />
        </span>
      )}
      {(manageable || onSetColor !== undefined || onDragStartCategory !== undefined) && (
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
          {onSetColor !== undefined && <ColorMenu t={t} color={color} onSelect={onSetColor} />}
          {manageable && (
            <Menu
              open={menuOpen}
              onClose={() => { setMenuOpen(false) }}
              items={[
                ...(onExpandEntire !== undefined ? [{ id: 'expandEntire', label: t('group.expandEntire') }] : []),
                ...(onCollapseEntire !== undefined ? [{ id: 'collapseEntire', label: t('group.collapseEntire') }] : []),
                ...(onMoveUp !== undefined ? [{ id: 'moveUp', label: t('group.moveUp'), disabled: canMoveUp === false || isFirst === true }] : []),
                ...(onMoveDown !== undefined ? [{ id: 'moveDown', label: t('group.moveDown'), disabled: canMoveDown === false || isLast === true }] : []),
                ...(onRename !== undefined ? [{ id: 'rename', label: t('group.rename'), icon: <IconEditOutline16 /> }] : []),
                ...(onDelete !== undefined ? [{ id: 'delete', label: t('group.delete'), icon: <IconTrashOutline16 />, danger: true }] : []),
              ]}
              onSelect={(id) => {
                setMenuOpen(false)
                if (id === 'expandEntire') onExpandEntire?.()
                if (id === 'collapseEntire') onCollapseEntire?.()
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
export function WorkspaceRow({ node, t, onToggle, onNewSession, onRename, onDelete, color, onSetColor, canMoveOut = false, onMoveOut, moveTargets, onMoveTo, onMoveUp, onMoveDown, onOpenFolder, onCopyPath, isFirst, isLast, canMoveUp, canMoveDown, flat = false, draggable = false, dropActive = false, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onWorkspaceDragStart, 'aria-level': ariaLevel, 'aria-posinset': ariaPosinset, 'aria-setsize': ariaSetsize }: {
  node: WorkspaceGroupNode
  t: T
  /** Omit for fixed-expanded, non-toggleable search branches. */
  onToggle?: () => void
  onNewSession?: () => void
  onRename?: () => void
  onDelete?: () => void
  color?: string | null | undefined
  onSetColor?: ((color: string | null) => void) | undefined
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
  /** Explicitly enable this Workspace row as a drag source. */
  draggable?: boolean
  /** Notify the browser after this row has populated the Workspace drag payload. */
  onWorkspaceDragStart?: (workspaceId: WorkspaceGroupNode['workspaceId'], event: DragEvent) => void
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
    onWorkspaceDragStart?.(node.workspaceId, event)
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
      onClick={onToggle}
      onKeyDown={onToggle === undefined ? undefined : handleKeyDown}
      onDragOver={onRowDragOver}
      onDragLeave={onRowDragLeave}
      onDrop={onRowDrop}
    >
      <span
        className="wgWorkspaceDragSource"
        data-wg-drag-source="workspace"
        draggable={draggable}
        onDragStart={draggable ? onDragStart : undefined}
      >
        <span className={`wgChevron${node.expanded ? ' wgChevronOpen' : ''}`}>
          <IconTriangleRightFill14 />
        </span>
        <span className="wgCategoryIcon" data-wg-row-icon="project">
          {/* Project rows use the project glyph (same as the official workspace
              browser) so groups (folder glyph) and projects stay distinguishable. */}
          <IconProjectAddOutline16 />
          {color && <span className="wgColorDot" data-color={color} />}
        </span>
        <span className="wgProjectLabel" title={node.path}>{node.label}</span>
      </span>
      {!node.expanded && node.attention !== undefined && (
        <span className="wgStatusSlot">
          <StateDot state={node.attention} />
        </span>
      )}
      {(menuItems.length > 0 || onSetColor !== undefined || onNewSession !== undefined) && <span className="wgRowActions">
        {onSetColor !== undefined && <ColorMenu t={t} color={color} onSelect={onSetColor} />}
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
  const dotState = sessionDotState(node)
  const pillLabel = dotState === 'error' ? t('session.statusError') : dotState === 'warning' ? t('session.statusAwaiting') : undefined
  const ariaLabel = pillLabel !== undefined ? `${node.title} (${pillLabel})` : node.title
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
      aria-label={ariaLabel}
      aria-level={ariaLevel}
      aria-posinset={ariaPosinset}
      aria-setsize={ariaSetsize}
      onClick={() => { onOpen(node.id) }}
      onKeyDown={handleKeyDown}
    >
      <span className="wgStatusSlot">
        {dotState !== undefined && <StateDot state={dotState} />}
      </span>
      <span className="wgSessionTitle">{node.title}</span>
      {pillLabel !== undefined && (
        <span className="wgSessionPill" data-status={dotState}>{pillLabel}</span>
      )}
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
