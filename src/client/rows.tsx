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
import { useMemo, useState, type DragEvent, type KeyboardEvent } from 'react'
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
} from '@deepseek-ai/dsh-client-ui-primitives'
import { ColorMenu } from './ColorMenu.tsx'
import {
  DND_WORKSPACE_TYPE,
  sessionDotState,
  relativeTimeLabel,
  type RowDropProps,
  type T,
  type WorkspaceMoveTarget,
} from './row-utils.ts'
import type { CategoryNode, SessionNode, WorkspaceGroupNode } from './tree.ts'

export * from './row-utils.ts'
export { ColorMenu } from './ColorMenu.tsx'
export type { ColorMenuProps } from './ColorMenu.tsx'

export interface CategoryRowProps extends RowDropProps {
  node: CategoryNode
  t: T
  /** Omit for fixed-expanded, non-toggleable search branches. */
  onToggle?: () => void
  onExpandEntire?: (() => void) | undefined
  onCollapseEntire?: (() => void) | undefined
  onAddWorkspace?: (() => void) | undefined
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
}

/**
 * One category folder row: toggle, rename/delete menu (every group — rule
 * groups via overlay renames/hides), draggable source for group reorder and
 * drop target for both workspace moves and group reorders.
 */
export function CategoryRow({
  node,
  t,
  onToggle,
  onExpandEntire,
  onCollapseEntire,
  onAddWorkspace,
  onRename,
  onDelete,
  color,
  onSetColor,
  dropActive = false,
  insertLine,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop,
  onDragStartCategory,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  canMoveUp,
  canMoveDown,
  'aria-level': ariaLevel,
  'aria-posinset': ariaPosinset,
  'aria-setsize': ariaSetsize,
}: CategoryRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const count = node.workspaces.length
  const manageable = (onRename !== undefined && onDelete !== undefined) || onExpandEntire !== undefined || onCollapseEntire !== undefined || onAddWorkspace !== undefined

  const menuItems = useMemo(() => [
    ...(onAddWorkspace !== undefined ? [{ id: 'addWorkspace', label: t('group.addWorkspace'), icon: <IconProjectAddOutline16 /> }] : []),
    ...(onExpandEntire !== undefined ? [{ id: 'expandEntire', label: t('group.expandEntire') }] : []),
    ...(onCollapseEntire !== undefined ? [{ id: 'collapseEntire', label: t('group.collapseEntire') }] : []),
    ...(onMoveUp !== undefined ? [{ id: 'moveUp', label: t('group.moveUp'), disabled: canMoveUp === false || isFirst === true }] : []),
    ...(onMoveDown !== undefined ? [{ id: 'moveDown', label: t('group.moveDown'), disabled: canMoveDown === false || isLast === true }] : []),
    ...(onRename !== undefined ? [{ id: 'rename', label: t('group.rename'), icon: <IconEditOutline16 /> }] : []),
    ...(onDelete !== undefined ? [{ id: 'delete', label: t('group.delete'), icon: <IconTrashOutline16 />, danger: true }] : []),
  ], [onAddWorkspace, onExpandEntire, onCollapseEntire, onMoveUp, onMoveDown, onRename, onDelete, t, canMoveUp, isFirst, canMoveDown, isLast])

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
              items={menuItems}
              onSelect={(id) => {
                setMenuOpen(false)
                if (id === 'addWorkspace') onAddWorkspace?.()
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
          {onAddWorkspace !== undefined && (
            <button
              type="button"
              className="wgIconButton"
              draggable={false}
              aria-label={`${t('group.addWorkspace')}: ${node.label}`}
              title={t('group.addWorkspace')}
              onClick={(e) => { e.stopPropagation(); onAddWorkspace() }}
              onKeyDown={(e) => { e.stopPropagation() }}
            >
              <IconProjectAddOutline16 />
            </button>
          )}
        </span>
      )}
    </div>
  )
}

export interface WorkspaceRowProps extends RowDropProps {
  node: WorkspaceGroupNode
  t: T
  /** Omit for fixed-expanded, non-toggleable search branches. */
  onToggle?: () => void
  onNewSession?: () => void
  onRename?: () => void
  onDelete?: () => void
  onCleanup?: (() => void) | undefined
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
}

/** One workspace folder row inside a category: draggable source + drop target. */
export function WorkspaceRow({
  node,
  t,
  onToggle,
  onNewSession,
  onRename,
  onDelete,
  onCleanup,
  color,
  onSetColor,
  canMoveOut = false,
  onMoveOut,
  moveTargets,
  onMoveTo,
  onMoveUp,
  onMoveDown,
  onOpenFolder,
  onCopyPath,
  isFirst,
  isLast,
  canMoveUp,
  canMoveDown,
  flat = false,
  draggable = false,
  dropActive = false,
  insertLine,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop,
  onWorkspaceDragStart,
  'aria-level': ariaLevel,
  'aria-posinset': ariaPosinset,
  'aria-setsize': ariaSetsize,
}: WorkspaceRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const menuItems = useMemo(() => [
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
    ...(onCleanup !== undefined ? [{ id: 'cleanup', label: t('cleanup.action'), icon: <IconArchiveOutline20 size={16} /> }] : []),
    ...(onRename !== undefined ? [{ id: 'rename', label: t('workspace.rename'), icon: <IconEditOutline16 /> }] : []),
    ...(onDelete !== undefined ? [{ id: 'delete', label: t('workspace.delete'), icon: <IconTrashOutline16 />, danger: true }] : []),
  ], [onMoveUp, onMoveDown, t, canMoveUp, isFirst, canMoveDown, isLast, moveTargets, onMoveTo, canMoveOut, onMoveOut, onOpenFolder, onCopyPath, onCleanup, onRename, onDelete])

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
            if (id === 'cleanup') onCleanup?.()
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

export interface SessionRowProps {
  node: SessionNode
  currentId: string | undefined
  now: number
  t: T
  onOpen: (id: SessionNode['id']) => void
  onRename?: (id: SessionNode['id'], currentTitle: string) => void
  onFork?: (id: SessionNode['id']) => void
  onArchive?: (id: SessionNode['id']) => void
  onPinToggle?: ((id: SessionNode['id']) => void) | undefined
  color?: string | null | undefined
  onSetColor?: ((color: string | null) => void) | undefined
  actionBusy?: boolean
  'aria-level'?: number
  'aria-posinset'?: number
  'aria-setsize'?: number
}

export function IconPin16({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  )
}

export function IconPinOff16({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="2" y1="2" x2="22" y2="22" />
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h12" />
      <path d="M15 9.34V6h1a2 2 0 0 0 0-4H7.89" />
    </svg>
  )
}

/** One session leaf row. */
export function SessionRow({
  node,
  currentId,
  now,
  t,
  onOpen,
  onRename,
  onFork,
  onArchive,
  onPinToggle,
  color,
  onSetColor,
  actionBusy = false,
  'aria-level': ariaLevel,
  'aria-posinset': ariaPosinset,
  'aria-setsize': ariaSetsize,
}: SessionRowProps) {
  const selected = node.id === currentId
  const [menuOpen, setMenuOpen] = useState(false)
  const pingColor = color ?? node.color
  const dotState = sessionDotState(node)
  const pillLabel = dotState === 'error' ? t('session.statusError') : dotState === 'warning' ? t('session.statusAwaiting') : undefined
  const ariaLabel = `${node.title}${node.pinned ? ` (${t('session.pinned')})` : ''}${pillLabel !== undefined ? ` (${pillLabel})` : ''}`

  const menuItems = useMemo(() => [
    ...(onPinToggle !== undefined ? [{
      id: 'pinToggle',
      label: node.pinned ? t('session.unpin') : t('session.pin'),
      icon: node.pinned ? <IconPinOff16 size={16} /> : <IconPin16 size={16} />,
      disabled: actionBusy,
    }] : []),
    ...(onRename !== undefined ? [{ id: 'rename', label: t('session.rename'), icon: <IconEditOutline16 /> }] : []),
    ...(onFork !== undefined ? [{ id: 'fork', label: t('session.fork'), icon: <IconBranchOutline16 />, disabled: actionBusy }] : []),
    ...(onArchive !== undefined ? [{ id: 'archive', label: t('session.archive'), icon: <IconArchiveOutline20 size={16} />, disabled: actionBusy }] : []),
  ], [node.pinned, onPinToggle, onRename, onFork, onArchive, t, actionBusy])

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
        {pingColor && <span className="wgColorDot" data-color={pingColor} />}
      </span>
      <span className="wgSessionTitle">{node.title}</span>
      {node.pinned && (
        <span className="wgSessionPinned" title={t('session.pinned')} aria-label={t('session.pinned')}>
          <IconPin16 size={12} />
        </span>
      )}
      {pillLabel !== undefined && (
        <span className="wgSessionPill" data-status={dotState}>{pillLabel}</span>
      )}
      {!node.blank && <span className="wgSessionTime">{relativeTimeLabel(node.updatedAt, now)}</span>}
      {node.snippet !== undefined && (
        <span className="wgSessionSnippet" title={node.snippet}>{node.snippet}</span>
      )}
      {!node.blank && (menuItems.length > 0 || onSetColor !== undefined) && (
        <span className="wgRowActions">
          {onSetColor !== undefined && <ColorMenu t={t} color={pingColor} onSelect={onSetColor} />}
          {menuItems.length > 0 && <Menu
            open={menuOpen}
            onClose={() => { setMenuOpen(false) }}
            items={menuItems}
            onSelect={(id) => {
              setMenuOpen(false)
              if (id === 'pinToggle') onPinToggle?.(node.id)
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
          />}
        </span>
      )}
    </div>
  )
}

export type { T }
