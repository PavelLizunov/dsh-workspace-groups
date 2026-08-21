/**
 * Row components for the workspace-groups tree. Kept dependency-light: they
 * consume only React, primitives (StateDot/Menu/icons), and the shared CSS
 * string. Each row owns its hover actions menu; dialogs live in the browser
 * root so they survive row unmounts during collapse.
 */
import { useState } from 'react'
import {
  IconArchiveOutline20,
  IconBranchOutline16,
  IconEditOutline16,
  IconEllipsisOutline16,
  IconFolderClose16,
  IconFolderOpen16,
  IconPlusOutline16,
  IconTriangleRightFill14,
  IconTrashOutline16,
  Menu,
  StateDot,
  type StateDotState,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceGroupsKey } from './locales.ts'
import type { CategoryNode, SessionNode, WorkspaceGroupNode } from './tree.ts'

type T = TranslateNS<'workspaceGroups'>

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

/** One category folder row. */
export function CategoryRow({ node, t, onToggle }: {
  node: CategoryNode
  t: T
  onToggle: () => void
}) {
  const count = node.workspaces.length
  return (
    <div
      className="wgCategoryRow"
      role="treeitem"
      aria-expanded={node.expanded}
      aria-label={t('section.workspaces')}
      onClick={onToggle}
    >
      <span className={`wgChevron${node.expanded ? ' wgChevronOpen' : ''}`}>
        <IconTriangleRightFill14 />
      </span>
      <span className="wgCategoryIcon">
        {node.expanded ? <IconFolderOpen16 /> : <IconFolderClose16 />}
      </span>
      <span className="wgCategoryLabel">{node.label}</span>
      <span className="wgCategoryCount">{count}</span>
    </div>
  )
}

/** One workspace folder row inside a category. */
export function WorkspaceRow({ node, t, onToggle, onNewSession, onRename, onDelete }: {
  node: WorkspaceGroupNode
  t: T
  onToggle: () => void
  onNewSession: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuItems = [
    { id: 'rename', label: t('workspace.rename'), icon: <IconEditOutline16 /> },
    { id: 'delete', label: t('workspace.delete'), icon: <IconTrashOutline16 />, danger: true },
  ]
  return (
    <div
      className={`wgProjectRow${node.containsCurrent ? ' wgProjectActive' : ''}`}
      role="treeitem"
      aria-expanded={node.expanded}
      onClick={onToggle}
    >
      <span className={`wgChevron${node.expanded ? ' wgChevronOpen' : ''}`}>
        <IconTriangleRightFill14 />
      </span>
      <span className="wgCategoryIcon">
        {node.expanded ? <IconFolderOpen16 /> : <IconFolderClose16 />}
      </span>
      <span className="wgProjectLabel" title={node.path}>{node.label}</span>
      <span className="wgRowActions">
        <Menu
          open={menuOpen}
          onClose={() => { setMenuOpen(false) }}
          items={menuItems}
          onSelect={(id) => {
            setMenuOpen(false)
            if (id === 'rename') onRename()
            if (id === 'delete') onDelete()
          }}
          portal
          closeOnPointerLeave
          anchor={(
            <button
              type="button"
              className="wgIconButton"
              aria-label={`${t('workspace.rename')} ${node.label}`}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
            >
              <IconEllipsisOutline16 />
            </button>
          )}
        />
        <button
          type="button"
          className="wgIconButton"
          aria-label={`${t('session.new')} ${node.label}`}
          onClick={(e) => { e.stopPropagation(); onNewSession() }}
        >
          <IconPlusOutline16 />
        </button>
      </span>
    </div>
  )
}

/** One session leaf row. */
export function SessionRow({ node, currentId, now, t, onOpen, onRename, onFork, onArchive }: {
  node: SessionNode
  currentId: string | undefined
  now: number
  t: T
  onOpen: (id: SessionNode['id']) => void
  onRename: (id: SessionNode['id'], currentTitle: string) => void
  onFork: (id: SessionNode['id']) => void
  onArchive: (id: SessionNode['id']) => void
}) {
  const selected = node.id === currentId
  const [menuOpen, setMenuOpen] = useState(false)
  const showStatus = true
  const menuItems = [
    { id: 'rename', label: t('session.rename'), icon: <IconEditOutline16 /> },
    { id: 'fork', label: t('session.fork'), icon: <IconBranchOutline16 /> },
    { id: 'archive', label: t('session.archive'), icon: <IconArchiveOutline20 size={16} /> },
  ]
  return (
    <div
      className={`wgSessionRow${selected ? ' wgSelected' : ''}${node.matched === true ? ' wgMatched' : ''}`}
      role="treeitem"
      aria-selected={selected}
      onClick={() => { onOpen(node.id) }}
    >
      <span className="wgStatusSlot">
        {showStatus && <StateDot state={sessionDotState(node)} />}
      </span>
      <span className="wgSessionTitle">{node.title}</span>
      {!node.blank && <span className="wgSessionTime">{relativeTimeLabel(node.updatedAt, now)}</span>}
      {node.snippet !== undefined && (
        <span className="wgSessionSnippet" title={node.snippet}>{node.snippet}</span>
      )}
      {!node.blank && (
        <span className="wgRowActions">
          <Menu
            open={menuOpen}
            onClose={() => { setMenuOpen(false) }}
            items={menuItems}
            onSelect={(id) => {
              setMenuOpen(false)
              if (id === 'rename') onRename(node.id, node.title)
              if (id === 'fork') onFork(node.id)
              if (id === 'archive') onArchive(node.id)
            }}
            portal
            closeOnPointerLeave
            anchor={(
              <button
                type="button"
                className="wgIconButton"
                aria-label={`${t('session.rename')} ${node.title}`}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
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
