/**
 * The workspace-groups browsing region filling the sidebar shell's
 * `sidebar.workspaces` hole: section header (title + right-aligned search +
 * new-group + add workspace), the three-level tree (category → workspace →
 * session), group management dialogs, and the workspace/session dialogs. Wide
 * state renders the full browser; rail state renders the two region icons
 * (search / add workspace) as 36px controls on the shell's shared rail entry
 * path, each requesting expansion through the owner share.
 *
 * Data: workspaces/sessions via the framework global hooks; grouping config
 * via the host half's `/workspace-groups/config` route (refetched on mount).
 * Runtime group management (create/rename/delete any group, drag workspaces
 * between groups and into position, drag groups into position) persists
 * through `PUT /workspace-groups/manual`; the sidecar YAML is never rewritten
 * (rule-group rename/delete ride the overlay `renamed`/`hidden` maps).
 */
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  Button,
  IconCloseFill14,
  IconFolderOpenOutline16,
  IconProjectAddOutline16,
  IconSearchOutline16,
  Modal,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId, SessionListState, SessionSearchResultItem, WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import {
  displayCategoryKeys,
  moveAfter,
  moveBefore,
  orderedWorkspaceIds,
  originalRuleNameForDisplay,
  resolveCategory,
  takenCategoryNames,
} from '../core/matcher.ts'
import { TOP_LEVEL_ORDER_KEY, UNCATEGORIZED_LABEL, type GroupsConfig, type ManualGroups } from '../core/types.ts'
import type { GroupsBrowserProps } from './contract.ts'
import { DirectoryBrowser } from './DirectoryBrowser.tsx'
import { moveWorkspace as moveWorkspaceOverlay, removeGroup, removeWorkspace, renameGroup, setItemColor } from './overlay-core.ts'
import { SESSION_ROW_LIMIT, visibleWorkspaceSessions } from './session-limit.ts'
import { deriveGroups, deriveSearchGroups, deriveSearchMatches, deriveTopLevel, UNCATEGORIZED_KEY, type CategoryNode, type SessionNode, type WorkspaceGroupNode } from './tree.ts'
import { CategoryRow, DND_CATEGORY_TYPE, DND_WORKSPACE_TYPE, hasPluginDragType, SessionRow, WorkspaceRow, type WorkspaceMoveTarget } from './rows.tsx'
import css from './styles.css?inline'

const SEARCH_DEBOUNCE_MS = 250
const SEARCH_QUERY_MAX_CODE_UNITS = 500

/** Overlay with every optional field materialized (plain-object edits, no undefined spreads). */
type NormalizedManual = Required<ManualGroups>

const EMPTY_MANUAL: NormalizedManual = {
  categories: [], assignments: {}, categoryOrder: [], workspaceOrder: {}, renamed: {}, hidden: [], colors: {},
}

/** Materialize optional overlay fields so every update is a plain object edit. */
function normalizeManual(manual: ManualGroups): NormalizedManual {
  return {
    categories: manual.categories,
    assignments: manual.assignments,
    categoryOrder: manual.categoryOrder ?? [],
    workspaceOrder: manual.workspaceOrder ?? {},
    renamed: manual.renamed ?? {},
    hidden: manual.hidden ?? [],
    colors: manual.colors ?? {},
  }
}

function sanitizeSearchQuery(value: string): string {
  const withoutNul = value.replaceAll('\0', '')
  if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS) return withoutNul
  return withoutNul.slice(0, SEARCH_QUERY_MAX_CODE_UNITS)
}

/** Immutable membership toggle for the local expand-all array. */
function toggled(list: readonly string[], key: string): string[] {
  return list.includes(key) ? list.filter(k => k !== key) : [...list, key]
}

interface RemoteSearchState {
  query: string
  status: 'idle' | 'loading' | 'ready' | 'error'
  items: readonly SessionSearchResultItem[]
  hasMore: boolean
}

/** Light runtime guard for the manual overlay attached to the config fetch. */
function isManualGroups(value: unknown): value is ManualGroups {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { categories?: unknown; assignments?: unknown }
  return Array.isArray(candidate.categories) && typeof candidate.assignments === 'object' && candidate.assignments !== null
}

/** Minimal fetch of the grouping config + runtime overlay (no-cache revalidation). */
async function fetchGroupsConfig(): Promise<{ config: GroupsConfig; manual: NormalizedManual; revision: string }> {
  const response = await fetch('/workspace-groups/config', { cache: 'no-cache' })
  if (!response.ok) throw new Error(`config request failed: ${response.status}`)
  const body = (await response.json()) as GroupsConfig & { revision?: string }
  const config: GroupsConfig = Array.isArray(body.categories) ? body : { categories: [] }
  const etag = response.headers.get('etag') || response.headers.get('ETag') || ''
  const revision = typeof body.revision === 'string' && body.revision !== ''
    ? body.revision
    : etag.replace(/^W\/"|"$/g, '')
  return {
    config,
    manual: isManualGroups(body.manual) ? normalizeManual(body.manual) : EMPTY_MANUAL,
    revision,
  }
}

class SaveConflictError extends Error {
  constructor(message = 'conflict') {
    super(message)
    this.name = 'SaveConflictError'
  }
}

function isConflictError(reason: unknown): boolean {
  return (
    reason instanceof SaveConflictError ||
    (reason instanceof Error &&
      (reason.name === 'SaveConflictError' ||
        reason.message === 'conflict' ||
        (reason as unknown as { status?: number }).status === 409))
  )
}

/** Persist the whole runtime overlay (idempotent; the host validates + writes). */
async function saveManualOverlay(manual: ManualGroups, expectedRevision: string): Promise<{ revision: string }> {
  const response = await fetch('/workspace-groups/manual', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedRevision, manual }),
  })
  if (response.status === 409) {
    throw new SaveConflictError()
  }
  if (!response.ok) {
    let message = `manual save failed: ${response.status}`
    try {
      const text = await response.text()
      if (text !== '') message = text
    } catch { /* keep the fallback message */ }
    throw new Error(message)
  }
  const body = (await response.json()) as { ok?: boolean; revision?: string }
  const etag = response.headers.get('etag') || response.headers.get('ETag') || ''
  const revision = typeof body.revision === 'string' && body.revision !== ''
    ? body.revision
    : etag.replace(/^W\/"|"$/g, '')
  return { revision }
}

/** One group-management dialog state: create, or rename an existing group. */
type GroupDialogState = { mode: 'create' } | { mode: 'rename'; from: string } | null

/** Row reference used by drop targets: which kind of row, which key. */
export type DropRowRef = { kind: 'category' | 'workspace' | 'topLevel'; key: string }

/** Which payload level is currently dragging; expansion remains unchanged. */
export type DragLevel = 'workspace' | 'category' | null

/**
 * Current drop indicator. A `line` renders a 2px insertion line above/below a
 * row (project reorder inside a group, or group reorder); an `into` renders
 * the whole-row highlight used when dropping a project into a group. Drop
 * handlers re-derive before/after from the drop event itself, so the
 * indicator is purely visual and can never go stale.
 */
export type DragIndicator =
  | { mode: 'line'; row: DropRowRef; before: boolean }
  | { mode: 'into'; categoryKey: string }
  | null

/**
 * Render the browsing region.
 * @param props - composed slot props (shell owner share + store + injected actions).
 * @returns the region element tree.
 */
export function GroupsBrowser({
  wide,
  expandSidebar,
  useSessions,
  useWorkspaces,
  useStore,
  actions,
  startSession,
  open,
  renameSession,
  forkSession,
  renameWorkspace,
  deleteWorkspace,
  insertWorkspaceBefore,
  archiveSession,
  insertSessionBefore,
  createWorkspace,
  listDirectory,
  createDirectory,
  searchSessions,
  searchResultLimit,
  t,
}: GroupsBrowserProps) {
  // Inject the stylesheet once per fiber; dispose removes it (HMR safe).
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-plugin', 'dsh-workspace-groups')
    style.textContent = css
    document.head.append(style)
    return () => { style.remove() }
  }, [])

  // Grouping config from the host route + the runtime manual overlay.
  const [config, setConfig] = useState<GroupsConfig>({ categories: [] })
  const [manual, setManual] = useState<NormalizedManual>(EMPTY_MANUAL)
  const [revision, setRevision] = useState<string>('')
  const [configError, setConfigError] = useState<string | null>(null)
  const [conflictError, setConflictError] = useState<boolean>(false)
  const reloadConfig = () => {
    setConfigError(null)
    return fetchGroupsConfig().then(({ config: nextConfig, manual: nextManual, revision: nextRevision }) => {
      setConfig(nextConfig)
      setManual(nextManual)
      setRevision(nextRevision)
      return { config: nextConfig, manual: nextManual, revision: nextRevision }
    }).catch((reason: unknown) => {
      setConfigError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  useEffect(() => { reloadConfig() }, [])

  // Transient save errors for drag/menu group operations (dialog errors are local).
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualSaving, setManualSaving] = useState(false)

  const workspaces = useWorkspaces(state => state.items)
  const workspacePhase = useWorkspaces(state => state.phase)
  const archivedSessionIds = useWorkspaces(state => state.archivedSessionIds)
  const categoryExpansion = useStore(s => s.categoryExpansion)
  const workspaceExpansion = useStore(s => s.workspaceExpansion)

  const list = useSessions(s => s)
  const current = list.current
  const currentWorkspaceKey = current === undefined
    ? undefined
    : (workspaces.find(w => w.sessionIds.includes(current as SessionId))?.workspaceId as string | undefined)

  // Auto-expand the category + workspace containing the current session, but
  // ONLY when the user has never touched that key (`Object.hasOwn`): a
  // present `false` is a deliberate collapse and must stay folded. Without
  // this guard the effect re-expands the just-collapsed current category on
  // every store change (the reported "cannot collapse" bug).
  useEffect(() => {
    if (current === undefined || currentWorkspaceKey === undefined) return
    const category = categoriesForCurrent(config, workspaces, current, manual)
    if (category !== undefined && !Object.hasOwn(categoryExpansion, category)) {
      actions.setCategoryExpanded(category, true)
    }
    if (!Object.hasOwn(workspaceExpansion, currentWorkspaceKey)) {
      actions.setWorkspaceExpanded(currentWorkspaceKey, true)
    }
  }, [current, currentWorkspaceKey, config, workspaces, manual, categoryExpansion, workspaceExpansion, actions])

  // Drop expansion keys that no longer exist (group edits / workspace deletion).
  useEffect(() => {
    if (workspacePhase !== 'ready') return
    actions.retainKeys(
      displayCategoryKeys(config, manual),
      workspaces.map(w => w.workspaceId as string),
    )
  }, [actions, config, manual, workspacePhase, workspaces])

  const [query, setQuery] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const normalizedQuery = sanitizeSearchQuery(query).trim()
  const [remoteSearch, setRemoteSearch] = useState<RemoteSearchState>({
    query: '', status: 'idle', items: [], hasMore: false,
  })
  const searchInput = useRef<HTMLInputElement | null>(null)
  const searchRoot = useRef<HTMLDivElement | null>(null)

  // Search debounce + abort, same posture as the official browser.
  useEffect(() => {
    if (normalizedQuery === '') {
      setRemoteSearch({ query: '', status: 'idle', items: [], hasMore: false })
      return
    }
    const controller = new AbortController()
    setRemoteSearch({ query: normalizedQuery, status: 'loading', items: [], hasMore: false })
    const timer = window.setTimeout(() => {
      searchSessions(normalizedQuery, controller.signal).then((result) => {
        if (controller.signal.aborted) return
        setRemoteSearch({ query: normalizedQuery, status: 'ready', items: result.items, hasMore: result.hasMore })
      }).catch(() => {
        if (controller.signal.aborted) return
        setRemoteSearch({ query: normalizedQuery, status: 'error', items: [], hasMore: false })
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [normalizedQuery, searchSessions])

  // Outside-click dismissal of the search box.
  useEffect(() => {
    if (!wide || !searchExpanded) return
    const onClick = (event: MouseEvent): void => {
      if (!(event.target instanceof Node) || searchRoot.current?.contains(event.target) === true) return
      searchInput.current?.blur()
      if (normalizedQuery !== '') return
      setSearchExpanded(false)
    }
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('click', onClick) }
  }, [normalizedQuery, wide, searchExpanded])

  const expandedCategories = useMemo(
    () => Object.entries(categoryExpansion).filter(([, v]) => v).map(([k]) => k),
    [categoryExpansion],
  )
  const expandedWorkspaces = useMemo(
    () => Object.entries(workspaceExpansion).filter(([, v]) => v).map(([k]) => k),
    [workspaceExpansion],
  )
  // Which level is being dragged: drives the top-level drop target (project
  // drags only) and which level's rows fold.
  const [dragging, setDragging] = useState<DragLevel>(null)
  const groups = useMemo(
    () => deriveGroups(list, workspaces, archivedSessionIds, config, {
      expandedCategories,
      expandedWorkspaces,
    }, manual),
    [list, workspaces, archivedSessionIds, config, manual, expandedCategories, expandedWorkspaces],
  )
  // Top-level (ungrouped) workspace rows, rendered after the group folders.
  const topLevel = useMemo(
    () => deriveTopLevel(list, workspaces, archivedSessionIds, config, {
      expandedCategories,
      expandedWorkspaces,
    }, manual),
    [list, workspaces, archivedSessionIds, config, manual, expandedCategories, expandedWorkspaces],
  )
  // While dragging a project, an empty top-level area must still show a landing
  // line — otherwise a project can never be dragged OUT of a group when every
  // project is currently grouped.
  const topLevelDropActive = dragging === 'workspace' && topLevel.length === 0
  const moveTargetsFor = (workspace: WorkspaceView): WorkspaceMoveTarget[] => {
    const currentKey = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title)
    return [
      { key: UNCATEGORIZED_KEY, label: t('section.topLevel'), current: currentKey === undefined },
      ...displayCategoryKeys(config, manual).map(key => ({ key, label: key, current: currentKey === key })),
    ]
  }
  // The top-level area is the move-out landing spot: rows reorder with an
  // insertion line (before/after), and the blank space below the last row
  // appends to the end of the list. No whole-area highlight box.
  const topLevelRef: DropRowRef = { kind: 'topLevel', key: UNCATEGORIZED_KEY }

  // Add Workspace uses the Host browse APIs; no native-only picker call.
  const [adding, setAdding] = useState(false)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addErrorOpen, setAddErrorOpen] = useState(false)
  const adoptDirectory = (path: string): void => {
    if (adding) return
    setAdding(true)
    setAddError(null)
    setAddErrorOpen(false)
    createWorkspace({ path }).then((workspace) => {
      setDirectoryOpen(false)
      startSession(workspace.workspaceId)
    }).catch((reason: unknown) => {
      setDirectoryOpen(false)
      setAddError(reason instanceof Error ? reason.message : String(reason))
      setAddErrorOpen(true)
    }).finally(() => { setAdding(false) })
  }
  const addWorkspace = (): void => {
    if (adding) return
    setAddError(null)
    setAddErrorOpen(false)
    setDirectoryOpen(true)
  }

  // Workspace rename dialog.
  const [renameTarget, setRenameTarget] = useState<{ workspaceId: WorkspaceId; currentTitle: string } | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const renameGeneration = useRef(0)
  const renameTrimmed = renameDraft.trim()
  const renameDuplicate = renameTarget !== null && renameTrimmed !== '' && renameTrimmed !== renameTarget.currentTitle
    && workspaces.some(w => w.title === renameTrimmed)
  const renameBlocked = renaming || renameTrimmed === '' || renameTarget === null
    || renameTrimmed === renameTarget.currentTitle || renameDuplicate
  const confirmRename = () => {
    if (renameBlocked || renameTarget === null) return
    const generation = ++renameGeneration.current
    const targetId = renameTarget.workspaceId
    setRenaming(true)
    setRenameError(null)
    renameWorkspace(targetId, renameTrimmed).then(() => {
      if (generation !== renameGeneration.current) return
      setRenaming(false)
      setRenameTarget(null)
    }).catch((reason: unknown) => {
      if (generation !== renameGeneration.current) return
      setRenaming(false)
      setRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  // Workspace delete dialog.
  const [deleteTarget, setDeleteTarget] = useState<{ workspaceId: WorkspaceId; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteGeneration = useRef(0)
  const confirmDelete = () => {
    if (deleting || deleteTarget === null) return
    const generation = ++deleteGeneration.current
    const targetId = deleteTarget.workspaceId
    setDeleting(true)
    setDeleteError(null)
    deleteWorkspace(targetId).then(async () => {
      if (generation !== deleteGeneration.current) return
      const nextManual = normalizeManual(removeWorkspace(manual, targetId))
      const res = await saveManualOverlay(nextManual, revision)
      if (generation !== deleteGeneration.current) return
      setManual(nextManual)
      setRevision(res.revision)
      setManualError(null)
      setConflictError(false)
      setDeleting(false)
      setDeleteTarget(null)
    }).catch((reason: unknown) => {
      if (generation !== deleteGeneration.current) return
      setDeleting(false)
      if (isConflictError(reason)) {
        setConflictError(true)
        setDeleteTarget(null)
        void reloadConfig()
      } else {
        setDeleteError(reason instanceof Error ? reason.message : String(reason))
      }
    })
  }

  // Session rename dialog.
  const [sessionRenameTarget, setSessionRenameTarget] = useState<{ sessionId: SessionId; currentTitle: string } | null>(null)
  const [sessionRenameDraft, setSessionRenameDraft] = useState('')
  const [sessionRenaming, setSessionRenaming] = useState(false)
  const [sessionRenameError, setSessionRenameError] = useState<string | null>(null)
  const sessionRenameGeneration = useRef(0)
  const [sessionActionError, setSessionActionError] = useState<string | null>(null)
  const [sessionActionBusy, setSessionActionBusy] = useState(false)
  const sessionRenameTrimmed = sessionRenameDraft.trim()
  const sessionRenameBlocked = sessionRenaming || sessionRenameTrimmed === '' || sessionRenameTarget === null
  const confirmSessionRename = () => {
    if (sessionRenameBlocked || sessionRenameTarget === null) return
    const generation = ++sessionRenameGeneration.current
    const targetId = sessionRenameTarget.sessionId
    setSessionRenaming(true)
    setSessionRenameError(null)
    renameSession(targetId, sessionRenameTrimmed).then(() => {
      if (generation !== sessionRenameGeneration.current) return
      setSessionRenaming(false)
      setSessionRenameTarget(null)
    }).catch((reason: unknown) => {
      if (generation !== sessionRenameGeneration.current) return
      setSessionRenaming(false)
      setSessionRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  const onSessionRename = (sessionId: SessionId, currentTitle: string) => {
    setSessionRenameTarget({ sessionId, currentTitle })
    setSessionRenameDraft(currentTitle)
    setSessionRenameError(null)
  }

  const onSessionFork = (sessionId: SessionId) => {
    if (sessionActionBusy) return
    setSessionActionBusy(true)
    setSessionActionError(null)
    forkSession(sessionId).catch((reason: unknown) => {
      setSessionActionError(`${t('session.forkError')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    }).finally(() => { setSessionActionBusy(false) })
  }
  const onSessionArchive = (sessionId: SessionId) => {
    if (sessionActionBusy) return
    setSessionActionBusy(true)
    setSessionActionError(null)
    archiveSession(sessionId).catch((reason: unknown) => {
      setSessionActionError(`${t('session.archiveError')}: ${reason instanceof Error ? reason.message : String(reason)}`)
    }).finally(() => { setSessionActionBusy(false) })
  }

  // ---- Runtime group management ----------------------------------------------

  const [groupDialog, setGroupDialog] = useState<GroupDialogState>(null)
  const [groupDraft, setGroupDraft] = useState('')
  const [groupError, setGroupError] = useState<string | null>(null)
  const [groupBusy, setGroupBusy] = useState(false)
  const [groupDeleteTarget, setGroupDeleteTarget] = useState<string | null>(null)
  const [groupDeleting, setGroupDeleting] = useState(false)
  const [groupDeleteError, setGroupDeleteError] = useState<string | null>(null)
  const groupGeneration = useRef(0)
  const groupDeleteGeneration = useRef(0)

  const takenNames = useMemo(() => takenCategoryNames(config, manual), [config, manual])

  const groupTrimmed = groupDraft.trim()
  const groupNameIssue = groupDialog !== null && groupTrimmed !== ''
    ? (groupTrimmed === UNCATEGORIZED_LABEL
        ? t('group.nameReserved')
        : (groupDialog.mode === 'rename' && groupTrimmed === groupDialog.from)
          ? null
          : takenNames.has(groupTrimmed) ? t('group.nameDuplicate') : null)
    : null
  const groupBlocked = groupBusy || groupTrimmed === '' || groupNameIssue !== null
    || (groupDialog !== null && groupDialog.mode === 'rename' && groupTrimmed === groupDialog.from)

  const confirmGroupDialog = () => {
    if (groupBlocked || groupDialog === null) return
    const name = groupTrimmed
    const from = groupDialog.mode === 'rename' ? groupDialog.from : undefined
    const renaming = groupDialog.mode === 'rename' && from !== name

    let next: NormalizedManual
    if (groupDialog.mode === 'create') {
      next = { ...manual, categories: [...manual.categories, name] }
    } else {
      const originalRule = from !== undefined ? originalRuleNameForDisplay(config.categories, manual, from) : undefined
      next = normalizeManual(renameGroup(manual, from ?? '', name, originalRule === undefined ? {} : { originalRuleName: originalRule }))
    }

    const generation = ++groupGeneration.current
    setGroupBusy(true)
    setGroupError(null)
    saveManualOverlay(next, revision).then(({ revision: nextRevision }) => {
      if (generation !== groupGeneration.current) return
      setManual(next)
      setRevision(nextRevision)
      setManualError(null)
      setConflictError(false)
      setGroupBusy(false)
      setGroupDialog(null)
      setGroupDraft('')
      // Keep the renamed group open (its old expansion key is dropped by retainKeys).
      if (renaming) actions.setCategoryExpanded(name, true)
    }).catch((reason: unknown) => {
      if (generation !== groupGeneration.current) return
      setGroupBusy(false)
      if (isConflictError(reason)) {
        setConflictError(true)
        setGroupDialog(null)
        void reloadConfig()
      } else {
        setGroupError(reason instanceof Error ? reason.message : String(reason))
      }
    })
  }

  const confirmGroupDelete = () => {
    if (groupDeleting || groupDeleteTarget === null) return
    const name = groupDeleteTarget
    const originalRule = originalRuleNameForDisplay(config.categories, manual, name)

    const next = normalizeManual(removeGroup(manual, name, originalRule === undefined ? {} : { originalRuleName: originalRule }))

    const generation = ++groupDeleteGeneration.current
    setGroupDeleting(true)
    setGroupDeleteError(null)
    saveManualOverlay(next, revision).then(({ revision: nextRevision }) => {
      if (generation !== groupDeleteGeneration.current) return
      setManual(next)
      setRevision(nextRevision)
      setManualError(null)
      setConflictError(false)
      setGroupDeleting(false)
      setGroupDeleteTarget(null)
    }).catch((reason: unknown) => {
      if (generation !== groupDeleteGeneration.current) return
      setGroupDeleting(false)
      if (isConflictError(reason)) {
        setConflictError(true)
        setGroupDeleteTarget(null)
        void reloadConfig()
      } else {
        setGroupDeleteError(reason instanceof Error ? reason.message : String(reason))
      }
    })
  }

  // ---- Drag & drop (move/reorder workspaces, reorder groups) ------------------

  const [dragIndicator, setDragIndicator] = useState<DragIndicator>(null)

  // Cancel any stale indicator when a drag ends outside a row (or is aborted).
  // Dragstart must not mutate expansion: collapsing rows above the source moves
  // it under the pointer and makes browsers cancel native dragging.
  useEffect(() => {
    const clear = () => {
      setDragIndicator(null)
      setDragging(null)
    }
    document.addEventListener('dragend', clear)
    return () => { document.removeEventListener('dragend', clear) }
  }, [])

  /** Move a workspace into a category (or reorder inside it when `beforeWorkspaceId`/`afterWorkspaceId`). */
  const moveWorkspaceTo = async (workspaceId: string, categoryKey: string, beforeWorkspaceId?: string, afterWorkspaceId?: string): Promise<void> => {
    if (manualSaving) return
    const workspace = workspaces.find(w => w.workspaceId === workspaceId)
    if (workspace === undefined) return
    const currentKey = resolveCategory(config, manual, workspaceId, workspace.path, workspace.title)
    const targetKey = categoryKey === UNCATEGORIZED_KEY ? undefined : categoryKey
    if (currentKey === targetKey && beforeWorkspaceId === undefined && afterWorkspaceId === undefined) return
    const targetMembers = workspaces
      .filter(w => w.workspaceId === workspaceId || resolveCategory(config, manual, w.workspaceId, w.path, w.title) === targetKey)
      .map(w => w.workspaceId as string)
    setManualSaving(true)
    try {
      const next = normalizeManual(moveWorkspaceOverlay(manual, {
        workspaceId,
        targetCategoryKey: targetKey ?? null,
        beforeId: beforeWorkspaceId,
        afterId: afterWorkspaceId,
        targetMembers,
      }))
      const { revision: nextRevision } = await saveManualOverlay(next, revision)
      setManual(next)
      setRevision(nextRevision)
      setManualError(null)
      setConflictError(false)
      if (categoryKey !== UNCATEGORIZED_KEY) actions.setCategoryExpanded(categoryKey, true)
    } catch (reason) {
      if (isConflictError(reason)) {
        setConflictError(true)
        void reloadConfig()
      } else {
        setManualError(reason instanceof Error ? reason.message : String(reason))
      }
    } finally {
      setManualSaving(false)
    }
  }

  /** Reorder groups: move `draggedKey` before `beforeKey` or after `afterKey` (uncategorized target = append). */
  const moveCategory = async (draggedKey: string, beforeKey?: string, afterKey?: string): Promise<void> => {
    if (manualSaving || draggedKey === beforeKey || draggedKey === afterKey) return
    setManualSaving(true)
    try {
      const order = displayCategoryKeys(config, manual)
      const categoryOrder = afterKey !== undefined
        ? moveAfter(order, draggedKey, afterKey)
        : moveBefore(order, draggedKey, beforeKey)
      const next: NormalizedManual = { ...manual, categoryOrder }
      const { revision: nextRevision } = await saveManualOverlay(next, revision)
      setManual(next)
      setRevision(nextRevision)
      setManualError(null)
      setConflictError(false)
    } catch (reason) {
      if (isConflictError(reason)) {
        setConflictError(true)
        void reloadConfig()
      } else {
        setManualError(reason instanceof Error ? reason.message : String(reason))
      }
    } finally {
      setManualSaving(false)
    }
  }

  /**
   * Drop on a row. The insertion point is re-derived from the drop event's
   * position (top half = before, bottom half = after), so it always matches
   * the indicator the user last saw — even when dragover and drop arrive in
   * the same tick.
   */
  const onDropRow = (categoryKey: string, row: DropRowRef) => (event: DragEvent): void => {
    event.preventDefault()
    // Keep the drop from bubbling to the enclosing top-level area (which is
    // also a move-out target): a row drop and the area-drop below it must not
    // both fire moveWorkspaceTo.
    event.stopPropagation()
    setDragIndicator(null)
    setDragging(null)
    const draggedCategory = event.dataTransfer.getData(DND_CATEGORY_TYPE)
    if (draggedCategory !== '') {
      // Group reorder: only category rows are targets (project rows fold
      // during group drags); before/after follows the drop position.
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const before = event.clientY < rect.top + rect.height / 2
      const beforeKey = row.kind === 'category' && before ? row.key : undefined
      const afterKey = row.kind === 'category' && !before ? row.key : undefined
      void moveCategory(draggedCategory, beforeKey, afterKey)
      return
    }
    const workspaceId = event.dataTransfer.getData(DND_WORKSPACE_TYPE) || event.dataTransfer.getData('text/plain')
    if (workspaceId === '') return
    if (row.kind === 'topLevel') {
      // Top-level row / top-level blank drop = move OUT of any group (forced
      // top-level, rules ignored) and set the position inside the ordered
      // top-level list. A row drop re-derives before/after from the drop
      // position; a bare area drop (key = UNCATEGORIZED_KEY) appends to the end.
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const before = event.clientY < rect.top + rect.height / 2
      const specificKey = row.key === UNCATEGORIZED_KEY ? undefined : row.key
      void moveWorkspaceTo(workspaceId, UNCATEGORIZED_KEY, before ? specificKey : undefined, !before ? specificKey : undefined)
      return
    }
    // Project move/reorder: a line on a project row = reorder before/after it;
    // dropping anywhere else in a category = move into the group (its end).
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const before = event.clientY < rect.top + rect.height / 2
    const beforeWsid = row.kind === 'workspace' && before ? row.key : undefined
    const afterWsid = row.kind === 'workspace' && !before ? row.key : undefined
    void moveWorkspaceTo(workspaceId, categoryKey, beforeWsid, afterWsid)
  }

  const onDragOverRow = (row: DropRowRef) => (event: DragEvent): void => {
    if (!hasPluginDragType(event.dataTransfer.types)) return
    const draggingCategory = Array.from(event.dataTransfer.types as Iterable<string>).includes(DND_CATEGORY_TYPE)
    if (draggingCategory && row.kind !== 'category') return // group drags target category rows only
    event.preventDefault()
    // Keep a row's dragover from bubbling to the enclosing top-level area
    // (which would interpret it as the end-of-list landing).
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const before = event.clientY < rect.top + rect.height / 2
    if (draggingCategory || row.kind === 'workspace' || row.kind === 'topLevel') {
      // Group reorder (line on a category row), project reorder inside a
      // group (line on a project row), or top-level reorder (line on a
      // top-level project row).
      setDragIndicator(prev =>
        prev?.mode === 'line' && prev.row.kind === row.kind && prev.row.key === row.key && prev.before === before
          ? prev
          : { mode: 'line', row, before })
    } else {
      // Dropping a project INTO a group: whole-row highlight.
      setDragIndicator(prev =>
        prev?.mode === 'into' && prev.categoryKey === row.key ? prev : { mode: 'into', categoryKey: row.key })
    }
  }

  const onDragLeaveRow = (event: DragEvent): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDragIndicator(null)
  }

  /**
   * Drag over the TOP-LEVEL AREA's blank space (not on a row — rows stop
   * propagation). An insertion line shows the landing spot: empty top level →
   * a standalone line under the last group; non-empty → a line below the last
   * top-level row (end of the list).
   */
  const onDragOverTopLevelArea = (event: DragEvent): void => {
    if (!hasPluginDragType(event.dataTransfer.types)) return
    const draggingCategory = Array.from(event.dataTransfer.types as Iterable<string>).includes(DND_CATEGORY_TYPE)
    if (draggingCategory) return // group drags never target the top-level area
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const last = topLevel.length > 0 ? topLevel[topLevel.length - 1] : undefined
    if (last !== undefined) {
      setDragIndicator(prev =>
        prev?.mode === 'line' && prev.row.kind === 'topLevel' && prev.row.key === last.workspaceId && prev.before === false
          ? prev
          : { mode: 'line', row: { kind: 'topLevel', key: last.workspaceId }, before: false })
    } else {
      setDragIndicator(prev =>
        prev?.mode === 'line' && prev.row.kind === 'topLevel' && prev.row.key === topLevelRef.key && prev.before === false
          ? prev
          : { mode: 'line', row: topLevelRef, before: false })
    }
  }

  // Keep the tree stable while native dragging starts. Synchronously folding
  // rows here moves lower sources under the pointer and cancels their drag.
  const onDragStartWorkspace = (_workspaceId: WorkspaceId, _event: DragEvent): void => {
    setDragging('workspace')
  }

  // While dragging a group, retain payload and dragging state only.
  const onDragStartCategory = (categoryKey: string) => (event: DragEvent): void => {
    event.dataTransfer.setData(DND_CATEGORY_TYPE, categoryKey)
    event.dataTransfer.effectAllowed = 'move'
    setDragging('category')
  }

  const onDragOverCategoryEnd = (event: DragEvent): void => {
    if (!hasPluginDragType(event.dataTransfer.types)) return
    const draggingCategory = Array.from(event.dataTransfer.types as Iterable<string>).includes(DND_CATEGORY_TYPE)
    if (!draggingCategory || groups.length === 0) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    const lastGroup = groups[groups.length - 1]
    if (lastGroup !== undefined) {
      setDragIndicator(prev =>
        prev?.mode === 'line' && prev.row.kind === 'category' && prev.row.key === lastGroup.key && prev.before === false
          ? prev
          : { mode: 'line', row: { kind: 'category', key: lastGroup.key }, before: false })
    }
  }

  const onDropCategoryEnd = (event: DragEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    setDragIndicator(null)
    setDragging(null)
    const draggedCategory = event.dataTransfer.getData(DND_CATEGORY_TYPE)
    if (draggedCategory !== '' && groups.length > 0) {
      const lastGroup = groups[groups.length - 1]
      if (lastGroup !== undefined && draggedCategory !== lastGroup.key) {
        void moveCategory(draggedCategory, undefined, lastGroup.key)
      }
    }
  }

  const now = Date.now()

  const moveCategoryUp = (key: string): void => {
    const keys = displayCategoryKeys(config, manual)
    const index = keys.indexOf(key)
    if (index <= 0) return
    const beforeKey = keys[index - 1]
    void moveCategory(key, beforeKey, undefined)
  }

  const moveCategoryDown = (key: string): void => {
    const keys = displayCategoryKeys(config, manual)
    const index = keys.indexOf(key)
    if (index === -1 || index >= keys.length - 1) return
    const afterKey = keys[index + 1]
    void moveCategory(key, undefined, afterKey)
  }

  const moveWorkspaceUp = (workspaceId: string): void => {
    const workspace = workspaces.find(w => w.workspaceId === workspaceId)
    if (workspace === undefined) return
    const currentKey = resolveCategory(config, manual, workspaceId, workspace.path, workspace.title)
    const targetKey = currentKey ?? UNCATEGORIZED_KEY
    const members = workspaces
      .filter(w => (currentKey === undefined ? resolveCategory(config, manual, w.workspaceId, w.path, w.title) === undefined : resolveCategory(config, manual, w.workspaceId, w.path, w.title) === currentKey))
      .map(w => w.workspaceId as string)
    const ordered = orderedWorkspaceIds(manual, currentKey ?? TOP_LEVEL_ORDER_KEY, members)
    const index = ordered.indexOf(workspaceId)
    if (index <= 0) return
    const beforeId = ordered[index - 1]
    void moveWorkspaceTo(workspaceId, targetKey, beforeId, undefined)
  }

  const moveWorkspaceDown = (workspaceId: string): void => {
    const workspace = workspaces.find(w => w.workspaceId === workspaceId)
    if (workspace === undefined) return
    const currentKey = resolveCategory(config, manual, workspaceId, workspace.path, workspace.title)
    const targetKey = currentKey ?? UNCATEGORIZED_KEY
    const members = workspaces
      .filter(w => (currentKey === undefined ? resolveCategory(config, manual, w.workspaceId, w.path, w.title) === undefined : resolveCategory(config, manual, w.workspaceId, w.path, w.title) === currentKey))
      .map(w => w.workspaceId as string)
    const ordered = orderedWorkspaceIds(manual, currentKey ?? TOP_LEVEL_ORDER_KEY, members)
    const index = ordered.indexOf(workspaceId)
    if (index === -1 || index >= ordered.length - 1) return
    const afterId = ordered[index + 1]
    void moveWorkspaceTo(workspaceId, targetKey, undefined, afterId)
  }

  const onOpenPath = (path: string): void => {
    setManualError('Open folder natively is not supported by the current connection')
  }

  const [pathCopiedToast, setPathCopiedToast] = useState<string | null>(null)
  const onCopyPath = (pathText: string): void => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(pathText).then(() => {
        setPathCopiedToast(t('workspace.pathCopied'))
        setTimeout(() => { setPathCopiedToast(null) }, 2000)
      }).catch((reason: unknown) => {
        setManualError(reason instanceof Error ? reason.message : String(reason))
      })
    }
  }

  const onSetItemColor = async (itemKey: string, color: string | null): Promise<void> => {
    if (manualSaving) return
    setManualSaving(true)
    try {
      const next = normalizeManual(setItemColor(manual, itemKey, color))
      const { revision: nextRevision } = await saveManualOverlay(next, revision)
      setManual(next)
      setRevision(nextRevision)
      setManualError(null)
      setConflictError(false)
    } catch (reason) {
      if (isConflictError(reason)) {
        setConflictError(true)
        void reloadConfig()
      } else {
        setManualError(reason instanceof Error ? reason.message : String(reason))
      }
    } finally {
      setManualSaving(false)
    }
  }

  return (
    <div className={`wgRoot${wide ? '' : ' wgRail'}`}>
      <div className="wgSectionHeader">
        {wide && (
          <span className={`wgSectionLabel${searchExpanded ? ' wgSectionLabelHidden' : ''}`}>
            {t('section.workspaces')}
          </span>
        )}
        {wide && (
          <div className={`wgSearch${searchExpanded ? ' wgSearchExpanded' : ''}`} ref={searchRoot}>
            <button
              type="button"
              className="wgIconButton"
              aria-label={t('search')}
              onClick={() => { setSearchExpanded(true) }}
            >
              <IconSearchOutline16 size={searchExpanded ? 11 : 14} />
            </button>
            {searchExpanded && (
              <input
                ref={searchInput}
                className="wgSearchInput"
                type="text"
                aria-label={t('search.placeholder')}
                placeholder={t('search.placeholder')}
                maxLength={SEARCH_QUERY_MAX_CODE_UNITS}
                value={query}
                autoFocus
                onChange={(e) => { setQuery(sanitizeSearchQuery(e.target.value)) }}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return
                  setQuery('')
                  setSearchExpanded(false)
                }}
              />
            )}
            {searchExpanded && (
              <button
                type="button"
                className="wgIconButton"
                aria-label={t('search.clear')}
                onClick={(e) => {
                  e.stopPropagation()
                  setQuery('')
                  setSearchExpanded(false)
                }}
              >
                <IconCloseFill14 />
              </button>
            )}
          </div>
        )}
        <div className={`wgHeaderActions${wide && searchExpanded ? ' wgHeaderActionsHidden' : ''}`}>
          {wide && (
            <Tooltip label={t('group.create')} side="bottom" delayMs={500}>
              <button
                type="button"
                className="wgIconButton"
                aria-label={t('group.create')}
                onClick={() => {
                  setGroupDraft('')
                  setGroupError(null)
                  setGroupDialog({ mode: 'create' })
                }}
              >
                <IconFolderOpenOutline16 size={16} />
              </button>
            </Tooltip>
          )}
          <Tooltip label={t('workspace.add')} side="bottom" delayMs={500}>
            <button
              type="button"
              className="wgIconButton"
              aria-label={t('workspace.add')}
              disabled={adding}
              onClick={addWorkspace}
            >
              <IconProjectAddOutline16 size={wide ? 16 : 18} />
            </button>
          </Tooltip>
        </div>
      </div>

      {!wide && (
        <div className="wgSectionHeader">
          <Tooltip label={t('search')}>
            <button
              type="button"
              className="wgIconButton"
              aria-label={t('search')}
              onClick={() => { setSearchExpanded(true); expandSidebar() }}
            >
              <IconSearchOutline16 size={18} />
            </button>
          </Tooltip>
        </div>
      )}

      {wide && (
        <div className="wgTreeBody">
          {configError !== null && (
            <div className="wgSearchStatus" role="status">{t('configUnavailable')}</div>
          )}
          {pathCopiedToast !== null && (
            <div className="wgSearchStatus" role="status">{pathCopiedToast}</div>
          )}
          {conflictError && (
            <div className="wgSearchStatus wgManualError" role="alert">
              <span>{t('manual.conflictError')}</span>
              <Button variant="outline" onClick={() => { void reloadConfig(); setConflictError(false) }}>{t('retry')}</Button>
            </div>
          )}
          {manualError !== null && !conflictError && (
            <div className="wgSearchStatus wgManualError" role="alert">{t('manual.saveError')}: {manualError}</div>
          )}
          {normalizedQuery !== '' ? (
            <SearchBody
              list={list}
              workspaces={workspaces}
              config={config}
              archivedSessionIds={archivedSessionIds}
              query={normalizedQuery}
              remote={remoteSearch}
              resultLimit={searchResultLimit}
              current={current}
              now={now}
              open={open}
              manual={manual}
              t={t}
              startSession={startSession}
              onWorkspaceRename={(workspaceId, title) => {
                setRenameTarget({ workspaceId, currentTitle: title })
                setRenameDraft(title)
                setRenameError(null)
              }}
              onWorkspaceDelete={(workspaceId, title) => {
                setDeleteTarget({ workspaceId, title })
                setDeleteError(null)
              }}
              onSessionRename={onSessionRename}
              onSessionFork={onSessionFork}
              onSessionArchive={onSessionArchive}
              sessionActionBusy={sessionActionBusy}
            />
          ) : (
            <div className="wgList" role="tree" aria-label={t('section.workspaces')}>
              {groups.length === 0 && (
                <div className="wgEmpty">{workspacePhase === 'ready' ? t('empty.noWorkspaces') : t('empty.none')}</div>
              )}
              {groups.map((category, idx) => (
                <CategorySection
                  key={category.key}
                  category={category}
                  categoryIndex={idx}
                  totalRootItems={groups.length + topLevel.length}
                  current={current}
                  now={now}
                  t={t}
                  dragIndicator={dragIndicator}
                  onDragOverRow={onDragOverRow}
                  onDragLeaveRow={onDragLeaveRow}
                  onDropRow={onDropRow}
                  onDragStartCategory={onDragStartCategory(category.key)}
                  onDragStartWorkspace={onDragStartWorkspace}
                  onToggleCategory={() => {
                    actions.setCategoryExpanded(category.key, !category.expanded)
                  }}
                  onToggleWorkspace={(key) => {
                    actions.setWorkspaceExpanded(key, !workspaceExpansion[key])
                  }}
                  onNewSession={startSession}
                  onOpen={open}
                  onRenameRequest={(workspaceId, title) => {
                    setRenameTarget({ workspaceId, currentTitle: title })
                    setRenameDraft(title)
                    setRenameError(null)
                  }}
                  onDeleteRequest={(workspaceId, title) => {
                    setDeleteTarget({ workspaceId, title })
                    setDeleteError(null)
                  }}
                  onSessionRename={onSessionRename}
                  onSessionArchive={onSessionArchive}
                  onFork={onSessionFork}
                  sessionActionBusy={sessionActionBusy}
                  onGroupRename={() => {
                    setGroupDraft(category.key)
                    setGroupError(null)
                    setGroupDialog({ mode: 'rename', from: category.key })
                  }}
                  onGroupDelete={() => {
                    setGroupDeleteTarget(category.key)
                    setGroupDeleteError(null)
                  }}
                  onMoveOut={(workspaceId) => { void moveWorkspaceTo(workspaceId, UNCATEGORIZED_KEY) }}
                  onMoveTo={(workspaceId, categoryKey) => { void moveWorkspaceTo(workspaceId, categoryKey) }}
                  onMoveGroupUp={moveCategoryUp}
                  onMoveGroupDown={moveCategoryDown}
                  onMoveWorkspaceUp={moveWorkspaceUp}
                  onMoveWorkspaceDown={moveWorkspaceDown}
                  onOpenFolder={onOpenPath}
                  onCopyPath={onCopyPath}
                  isFirstGroup={idx === 0}
                  isLastGroup={idx === groups.length - 1}
                  moveTargetsFor={(workspaceId) => {
                    const workspace = workspaces.find(w => w.workspaceId === workspaceId)
                    return workspace === undefined ? [] : moveTargetsFor(workspace)
                  }}
                  canMoveOut={(workspaceId) => {
                    const workspace = workspaces.find(w => w.workspaceId === workspaceId)
                    return workspace !== undefined
                      && resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title) !== undefined
                  }}
                  manual={manual}
                  onSetItemColor={onSetItemColor}
                />
              ))}
              <div
                className={dragging === 'category' ? 'wgCategoryDropEnd wgCategoryDropEndActive' : 'wgCategoryDropEnd'}
                data-wg-category-drop-end
                onDragOver={onDragOverCategoryEnd}
                onDragLeave={onDragLeaveRow}
                onDrop={onDropCategoryEnd}
              >
                {dragging === 'category' && <span className="wgCategoryDropEndLine" />}
              </div>
              {/* Top-level (ungrouped) workspaces, rendered after the group
                  folders. While dragging a project the whole area is the
                  move-out landing spot (a line shows the insert position;
                  an empty top level shows a line under the last group). */}
              {(topLevel.length > 0 || topLevelDropActive) && (
                <TopLevelSection
                  topLevel={topLevel}
                  totalGroups={groups.length}
                  totalRootItems={groups.length + topLevel.length}
                  current={current}
                  now={now}
                  t={t}
                  dragging={dragging === 'workspace'}
                  dragIndicator={dragIndicator}
                  topLevelRef={topLevelRef}
                  onDragOverRow={onDragOverRow}
                  onDragOverTopLevelArea={onDragOverTopLevelArea}
                  onDragLeaveRow={onDragLeaveRow}
                  onDropRow={onDropRow}
                  onDragStartWorkspace={onDragStartWorkspace}
                  onToggleWorkspace={(key) => {
                    actions.setWorkspaceExpanded(key, !workspaceExpansion[key])
                  }}
                  onNewSession={startSession}
                  onOpen={open}
                  onRenameRequest={(workspaceId, title) => {
                    setRenameTarget({ workspaceId, currentTitle: title })
                    setRenameDraft(title)
                    setRenameError(null)
                  }}
                  onDeleteRequest={(workspaceId, title) => {
                    setDeleteTarget({ workspaceId, title })
                    setDeleteError(null)
                  }}
                  onSessionRename={onSessionRename}
                  onSessionArchive={onSessionArchive}
                  onFork={onSessionFork}
                  sessionActionBusy={sessionActionBusy}
                  onMoveTo={(workspaceId, categoryKey) => { void moveWorkspaceTo(workspaceId, categoryKey) }}
                  moveTargetsFor={(workspaceId) => {
                    const workspace = workspaces.find(w => w.workspaceId === workspaceId)
                    return workspace === undefined ? [] : moveTargetsFor(workspace)
                  }}
                  onMoveWorkspaceUp={moveWorkspaceUp}
                  onMoveWorkspaceDown={moveWorkspaceDown}
                  onOpenFolder={onOpenPath}
                  onCopyPath={onCopyPath}
                  manual={manual}
                  onSetItemColor={onSetItemColor}
                />
              )}
            </div>
          )}
        </div>
      )}

      {wide && sessionActionError !== null && (
        <div className="wgSearchStatus wgManualError" role="alert">
          {sessionActionError}
          <Button variant="outline" onClick={() => { setSessionActionError(null) }}>{t('close')}</Button>
        </div>
      )}

      {/* Group create / rename dialog */}
      <Modal
        open={groupDialog !== null}
        onClose={() => { if (!groupBusy) { groupGeneration.current += 1; setGroupDialog(null); setGroupError(null) } }}
        closeLabel={t('close')}
        title={groupDialog?.mode === 'rename' ? t('group.renameTitle') : t('group.createTitle')}
        footer={(
          <>
            <Button variant="outline" disabled={groupBusy} onClick={() => { groupGeneration.current += 1; setGroupDialog(null); setGroupError(null) }}>{t('group.createCancel')}</Button>
            <Button variant="primary" disabled={groupBlocked} onClick={confirmGroupDialog}>
              {groupBusy ? (groupDialog?.mode === 'rename' ? t('group.renaming') : t('group.creating')) : groupDialog?.mode === 'rename' ? t('group.renameConfirm') : t('group.createConfirm')}
            </Button>
          </>
        )}
      >
        <input
          className="wgRenameInput"
          value={groupDraft}
          aria-label={t('group.createPlaceholder')}
          placeholder={t('group.createPlaceholder')}
          autoFocus
          disabled={groupBusy}
          onChange={(e) => { setGroupDraft(e.target.value); setGroupError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') confirmGroupDialog() }}
        />
        {groupNameIssue !== null && <div className="wgAddError" role="alert">{groupNameIssue}</div>}
        {groupError !== null && <div className="wgAddError" role="alert">{groupError}</div>}
      </Modal>

      {/* Group delete dialog */}
      <Modal
        open={groupDeleteTarget !== null}
        onClose={() => { if (!groupDeleting) { groupDeleteGeneration.current += 1; setGroupDeleteTarget(null); setGroupDeleteError(null) } }}
        closeLabel={t('close')}
        title={t('group.deleteTitle')}
        footer={(
          <>
            <Button variant="outline" disabled={groupDeleting} onClick={() => { groupDeleteGeneration.current += 1; setGroupDeleteTarget(null); setGroupDeleteError(null) }}>{t('group.deleteCancel')}</Button>
            <Button variant="outline" disabled={groupDeleting} onClick={confirmGroupDelete}>{groupDeleting ? t('group.deleting') : t('group.delete')}</Button>
          </>
        )}
      >
        <div className="wgAddError">{t('group.deleteConfirm')}</div>
        {groupDeleteError !== null && <div className="wgAddError" role="alert">{groupDeleteError}</div>}
      </Modal>

      {/* Workspace rename dialog */}
      <Modal
        open={renameTarget !== null}
        onClose={() => { if (!renaming) { renameGeneration.current += 1; setRenameTarget(null); setRenameError(null) } }}
        closeLabel={t('close')}
        title={t('workspace.renameTitle')}
        footer={(
          <>
            <Button variant="outline" disabled={renaming} onClick={() => { renameGeneration.current += 1; setRenameTarget(null); setRenameError(null) }}>{t('workspace.renameCancel')}</Button>
            <Button variant="primary" disabled={renameBlocked} onClick={confirmRename}>{renaming ? t('workspace.renaming') : t('workspace.renameConfirm')}</Button>
          </>
        )}
      >
        <input
          className="wgRenameInput"
          value={renameDraft}
          aria-label={t("workspace.renamePlaceholder")}
          autoFocus
          disabled={renaming}
          onChange={(e) => { setRenameDraft(e.target.value) }}
          onKeyDown={(e) => { if (e.key === "Enter") confirmRename() }}
        />
        {renameDuplicate && <div className="wgAddError" role="alert">{t('workspace.nameDuplicate')}</div>}
        {renameError !== null && <div className="wgAddError" role="alert">{renameError}</div>}
      </Modal>

      {/* Workspace delete dialog */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => { if (!deleting) { deleteGeneration.current += 1; setDeleteTarget(null); setDeleteError(null) } }}
        closeLabel={t('close')}
        title={t('workspace.deleteTitle')}
        footer={(
          <>
            <Button variant="outline" disabled={deleting} onClick={() => { deleteGeneration.current += 1; setDeleteTarget(null); setDeleteError(null) }}>{t('workspace.deleteCancel')}</Button>
            <Button variant="outline" disabled={deleting} onClick={confirmDelete}>{deleting ? t('workspace.deleting') : t('workspace.delete')}</Button>
          </>
        )}
      >
        <div className="wgAddError">{t('workspace.deleteConfirm')}</div>
        {deleteError !== null && <div className="wgAddError" role="alert">{deleteError}</div>}
      </Modal>

      {/* Session rename dialog */}
      <Modal
        open={sessionRenameTarget !== null}
        onClose={() => { if (!sessionRenaming) { sessionRenameGeneration.current += 1; setSessionRenameTarget(null); setSessionRenameError(null) } }}
        closeLabel={t('close')}
        title={t('session.renameTitle')}
        footer={(
          <>
            <Button variant="outline" disabled={sessionRenaming} onClick={() => { sessionRenameGeneration.current += 1; setSessionRenameTarget(null); setSessionRenameError(null) }}>{t('session.renameCancel')}</Button>
            <Button variant="primary" disabled={sessionRenameBlocked} onClick={confirmSessionRename}>{sessionRenaming ? t('session.renaming') : t('session.renameConfirm')}</Button>
          </>
        )}
      >
        <input
          className="wgRenameInput"
          value={sessionRenameDraft}
          aria-label={t("session.renamePlaceholder")}
          autoFocus
          disabled={sessionRenaming}
          onChange={(e) => { setSessionRenameDraft(e.target.value) }}
          onKeyDown={(e) => { if (e.key === "Enter") confirmSessionRename() }}
        />
        {sessionRenameError !== null && <div className="wgAddError" role="alert">{sessionRenameError}</div>}
      </Modal>

      <DirectoryBrowser
        open={directoryOpen}
        busy={adding}
        listDirectory={listDirectory}
        createDirectory={createDirectory}
        onPick={adoptDirectory}
        onClose={() => { if (!adding) setDirectoryOpen(false) }}
        strings={{
          title: t('directory.title'),
          home: t('directory.home'),
          newFolder: t('directory.newFolder'),
          folderName: t('directory.folderName'),
          create: t('directory.create'),
          cancel: t('directory.cancel'),
          open: t('directory.open'),
          loading: t('directory.loading'),
          retry: t('directory.retry'),
          showHidden: t('directory.showHidden'),
          truncated: t('directory.truncated'),
          pathPlaceholder: t('directory.pathPlaceholder'),
          go: t('directory.go'),
          refresh: t('directory.refresh'),
        }}
      />

      {/* Add workspace error dialog */}
      <Modal
        open={addErrorOpen}
        onClose={() => { setAddErrorOpen(false) }}
        closeLabel={t('close')}
        title={t('workspace.addErrorTitle')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setAddErrorOpen(false) }}>{t('close')}</Button>
            <Button variant="primary" onClick={addWorkspace}>{t('retry')}</Button>
          </>
        )}
      >
        <div className="wgAddError" role="alert">{addError}</div>
      </Modal>
    </div>
  )
}

/** Resolve the category label containing the current session (auto-expand helper). */
function categoriesForCurrent(
  config: GroupsConfig,
  workspaces: readonly WorkspaceView[],
  current: SessionId,
  manual: ManualGroups,
): string | undefined {
  const workspace = workspaces.find(w => w.sessionIds.includes(current))
  if (workspace === undefined) return undefined
  return resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title)
}

/**
 * Roving focus listener for tree navigation via ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End.
 */
function handleTreeKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
  const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!navKeys.includes(event.key)) return

  const targetTag = (event.target as HTMLElement).tagName
  if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') return

  const tree = event.currentTarget
  const items = Array.from(tree.querySelectorAll<HTMLElement>('[role="treeitem"]'))
  if (items.length === 0) return

  const targetItem = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')
  if (!targetItem || !items.includes(targetItem)) return

  const currentIndex = items.indexOf(targetItem)
  let nextIndex: number | undefined

  switch (event.key) {
    case 'ArrowDown':
      nextIndex = Math.min(items.length - 1, currentIndex + 1)
      break
    case 'ArrowUp':
      nextIndex = Math.max(0, currentIndex - 1)
      break
    case 'Home':
      nextIndex = 0
      break
    case 'End':
      nextIndex = items.length - 1
      break
    case 'ArrowRight': {
      const expanded = targetItem.getAttribute('aria-expanded')
      if (expanded === 'false') {
        event.preventDefault()
        targetItem.click()
        return
      } else if (expanded === 'true') {
        if (currentIndex + 1 < items.length) {
          nextIndex = currentIndex + 1
        }
      }
      break
    }
    case 'ArrowLeft': {
      const expanded = targetItem.getAttribute('aria-expanded')
      if (expanded === 'true') {
        event.preventDefault()
        targetItem.click()
        return
      } else {
        const currentLevel = parseInt(targetItem.getAttribute('aria-level') || '1', 10)
        if (currentLevel > 1) {
          for (let i = currentIndex - 1; i >= 0; i--) {
            const level = parseInt(items[i]!.getAttribute('aria-level') || '1', 10)
            if (level === currentLevel - 1) {
              nextIndex = i
              break
            }
          }
        }
      }
      break
    }
  }

  if (nextIndex !== undefined && nextIndex !== currentIndex) {
    event.preventDefault()
    const nextItem = items[nextIndex]!
    items.forEach(item => {
      if (item === nextItem) {
        item.setAttribute('tabindex', '0')
      } else {
        item.setAttribute('tabindex', '-1')
      }
    })
    nextItem.focus()
  }
}

function handleTreeFocus(event: React.FocusEvent<HTMLElement>): void {
  const targetItem = (event.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]')
  if (!targetItem) return
  const tree = event.currentTarget
  const items = tree.querySelectorAll<HTMLElement>('[role="treeitem"]')
  items.forEach(item => {
    if (item === targetItem) {
      item.setAttribute('tabindex', '0')
    } else {
      item.setAttribute('tabindex', '-1')
    }
  })
}

/** Shared limited session list for grouped and top-level workspaces. */
function WorkspaceSessions({
  sessions,
  current,
  now,
  t,
  ariaLevel,
  onOpen,
  onSessionRename,
  onSessionArchive,
  onFork,
  sessionActionBusy,
}: {
  sessions: readonly SessionNode[]
  current: SessionId | undefined
  now: number
  t: GroupsBrowserProps['t']
  ariaLevel: number
  onOpen: (sessionId: SessionId) => void
  onSessionRename: (sessionId: SessionId, currentTitle: string) => void
  onSessionArchive: (sessionId: SessionId) => void
  onFork: (sessionId: SessionId) => void
  sessionActionBusy: boolean
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = visibleWorkspaceSessions(sessions, current, showAll)
  const hasToggle = sessions.length > SESSION_ROW_LIMIT

  return (
    <>
      {visible.map((session) => (
        <SessionRow
          key={session.id}
          node={session}
          currentId={current}
          now={now}
          t={t}
          aria-level={ariaLevel}
          aria-posinset={sessions.indexOf(session) + 1}
          aria-setsize={sessions.length}
          onOpen={onOpen}
          onRename={onSessionRename}
          onFork={onFork}
          onArchive={onSessionArchive}
          actionBusy={sessionActionBusy}
        />
      ))}
      {hasToggle && (
        <div className="wgSessionToggle">
          <button
            type="button"
            className="wgSessionToggleBtn"
            onClick={() => { setShowAll(prev => !prev) }}
          >
            {showAll ? t('collapse') : t('expandMore')}
          </button>
        </div>
      )}
    </>
  )
}

/** One category section: header row + expanded workspace folders. */
function CategorySection({ category, categoryIndex, totalRootItems, current, now, t, dragIndicator, onDragOverRow, onDragLeaveRow, onDropRow, onDragStartCategory, onDragStartWorkspace, onToggleCategory, onToggleWorkspace, onNewSession, onOpen, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, onFork, sessionActionBusy, onGroupRename, onGroupDelete, onMoveOut, onMoveTo, moveTargetsFor, canMoveOut, onMoveGroupUp, onMoveGroupDown, onMoveWorkspaceUp, onMoveWorkspaceDown, onOpenFolder, onCopyPath, isFirstGroup, isLastGroup, manual, onSetItemColor }: {
  category: CategoryNode
  categoryIndex: number
  totalRootItems: number
  current: SessionId | undefined
  now: number
  t: GroupsBrowserProps['t']
  dragIndicator: DragIndicator
  onDragOverRow: (row: DropRowRef) => (event: DragEvent) => void
  onDragLeaveRow: (event: DragEvent) => void
  /** Drop factory: bind the target category and the row kind (before/after re-derived at drop time). */
  onDropRow: (categoryKey: string, row: DropRowRef) => (event: DragEvent) => void
  onDragStartCategory: (event: DragEvent) => void
  onDragStartWorkspace: (workspaceId: WorkspaceId, event: DragEvent) => void
  onToggleCategory: () => void
  onToggleWorkspace: (key: string) => void
  onNewSession: (workspaceId?: WorkspaceId) => void
  onOpen: (sessionId: SessionId) => void
  onRenameRequest: (workspaceId: WorkspaceId, currentTitle: string) => void
  onDeleteRequest: (workspaceId: WorkspaceId, title: string) => void
  onSessionRename: (sessionId: SessionId, currentTitle: string) => void
  onSessionArchive: (sessionId: SessionId) => void
  onFork: (sessionId: SessionId) => void
  sessionActionBusy: boolean
  onGroupRename: () => void
  onGroupDelete: () => void
  onMoveOut: (workspaceId: WorkspaceId) => void
  onMoveTo: (workspaceId: WorkspaceId, categoryKey: string) => void
  moveTargetsFor: (workspaceId: WorkspaceId) => readonly WorkspaceMoveTarget[]
  canMoveOut: (workspaceId: WorkspaceId) => boolean
  onMoveGroupUp: (key: string) => void
  onMoveGroupDown: (key: string) => void
  onMoveWorkspaceUp: (workspaceId: string) => void
  onMoveWorkspaceDown: (workspaceId: string) => void
  onOpenFolder: (path: string) => void
  onCopyPath: (path: string) => void
  isFirstGroup: boolean
  isLastGroup: boolean
  manual: ManualGroups
  onSetItemColor: (itemKey: string, color: string | null) => void
}) {
  const categoryLine = dragIndicator?.mode === 'line' && dragIndicator.row.kind === 'category' && dragIndicator.row.key === category.key
    ? (dragIndicator.before ? 'before' : 'after')
    : undefined
  const categoryInto = dragIndicator?.mode === 'into' && dragIndicator.categoryKey === category.key
  return (
    <div role="group">
      <CategoryRow
        node={category}
        t={t}
        aria-level={1}
        aria-posinset={categoryIndex + 1}
        aria-setsize={totalRootItems}
        onToggle={onToggleCategory}
        onRename={onGroupRename}
        onDelete={onGroupDelete}
        color={manual.colors?.[category.key]}
        onSetColor={(color) => { void onSetItemColor(category.key, color) }}
        onDragStartCategory={onDragStartCategory}
        onMoveUp={() => { onMoveGroupUp(category.key) }}
        onMoveDown={() => { onMoveGroupDown(category.key) }}
        isFirst={isFirstGroup}
        isLast={isLastGroup}
        canMoveUp={!isFirstGroup}
        canMoveDown={!isLastGroup}
        dropActive={categoryInto}
        {...(categoryLine !== undefined ? { insertLine: categoryLine } : {})}
        onRowDragOver={onDragOverRow({ kind: 'category', key: category.key })}
        onRowDragLeave={onDragLeaveRow}
        onRowDrop={onDropRow(category.key, { kind: 'category', key: category.key })}
      />
      {category.expanded && (
        <div role="group">
          {category.workspaces.map((workspace, idx) => (
            <div key={workspace.workspaceId} role="group">
              <WorkspaceRow
                node={workspace}
                t={t}
                aria-level={2}
                aria-posinset={idx + 1}
                aria-setsize={category.workspaces.length}
                onToggle={() => { onToggleWorkspace(workspace.workspaceId as string) }}
                onNewSession={() => { onNewSession(workspace.workspaceId) }}
                onRename={() => { onRenameRequest(workspace.workspaceId, workspace.label) }}
                onDelete={() => { onDeleteRequest(workspace.workspaceId, workspace.label) }}
                color={manual.colors?.[workspace.workspaceId]}
                onSetColor={(color) => { void onSetItemColor(workspace.workspaceId, color) }}
                canMoveOut={canMoveOut(workspace.workspaceId)}
                onMoveOut={() => { onMoveOut(workspace.workspaceId) }}
                moveTargets={moveTargetsFor(workspace.workspaceId)}
                onMoveTo={(categoryKey) => { onMoveTo(workspace.workspaceId, categoryKey) }}
                onMoveUp={() => { onMoveWorkspaceUp(workspace.workspaceId as string) }}
                onMoveDown={() => { onMoveWorkspaceDown(workspace.workspaceId as string) }}
                onOpenFolder={() => { onOpenFolder(workspace.path) }}
                onCopyPath={() => { onCopyPath(workspace.path) }}
                isFirst={idx === 0}
                isLast={idx === category.workspaces.length - 1}
                canMoveUp={idx > 0}
                canMoveDown={idx < category.workspaces.length - 1}
                dropActive={false}
                {...(dragIndicator?.mode === 'line' && dragIndicator.row.kind === 'workspace' && dragIndicator.row.key === workspace.workspaceId
                  ? { insertLine: dragIndicator.before ? 'before' : 'after' }
                  : {})}
                onRowDragOver={onDragOverRow({ kind: 'workspace', key: workspace.workspaceId })}
                onRowDragLeave={onDragLeaveRow}
                onRowDrop={onDropRow(category.key, { kind: 'workspace', key: workspace.workspaceId })}
                draggable
                onWorkspaceDragStart={onDragStartWorkspace}
              />
              {workspace.expanded && (
                <WorkspaceSessions
                  sessions={workspace.sessions}
                  current={current}
                  now={now}
                  t={t}
                  ariaLevel={3}
                  onOpen={onOpen}
                  onSessionRename={onSessionRename}
                  onSessionArchive={onSessionArchive}
                  onFork={onFork}
                  sessionActionBusy={sessionActionBusy}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Top-level (ungrouped) workspace rows rendered after the group folders. While
 * a project drag is in progress the WHOLE top-level area is the move-out
 * landing spot, shown with an insertion LINE (not a highlight box):
 * - a top-level row reorders before/after it (line above/below, like a group);
 * - the blank space below the last row appends to the end (line below the
 *   last row);
 * - an empty top level shows a standalone line under the last group folder.
 */
function TopLevelSection({ topLevel, totalGroups, totalRootItems, current, now, t, dragging, dragIndicator, topLevelRef, onDragOverRow, onDragOverTopLevelArea, onDragLeaveRow, onDropRow, onDragStartWorkspace, onToggleWorkspace, onNewSession, onOpen, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, onFork, sessionActionBusy, onMoveTo, moveTargetsFor, onMoveWorkspaceUp, onMoveWorkspaceDown, onOpenFolder, onCopyPath, manual, onSetItemColor }: {
  topLevel: readonly WorkspaceGroupNode[]
  totalGroups: number
  totalRootItems: number
  current: SessionId | undefined
  now: number
  t: GroupsBrowserProps['t']
  /** A project drag is in progress (drives the empty-top-level landing line). */
  dragging: boolean
  dragIndicator: DragIndicator
  topLevelRef: DropRowRef
  onDragOverRow: (row: DropRowRef) => (event: DragEvent) => void
  onDragOverTopLevelArea: (event: DragEvent) => void
  onDragLeaveRow: (event: DragEvent) => void
  onDropRow: (categoryKey: string, row: DropRowRef) => (event: DragEvent) => void
  onDragStartWorkspace: (workspaceId: WorkspaceId, event: DragEvent) => void
  onToggleWorkspace: (key: string) => void
  onNewSession: (workspaceId?: WorkspaceId) => void
  onOpen: (sessionId: SessionId) => void
  onRenameRequest: (workspaceId: WorkspaceId, currentTitle: string) => void
  onDeleteRequest: (workspaceId: WorkspaceId, title: string) => void
  onSessionRename: (sessionId: SessionId, currentTitle: string) => void
  onSessionArchive: (sessionId: SessionId) => void
  onFork: (sessionId: SessionId) => void
  sessionActionBusy: boolean
  onMoveTo: (workspaceId: WorkspaceId, categoryKey: string) => void
  moveTargetsFor: (workspaceId: WorkspaceId) => readonly WorkspaceMoveTarget[]
  onMoveWorkspaceUp: (workspaceId: string) => void
  onMoveWorkspaceDown: (workspaceId: string) => void
  onOpenFolder: (path: string) => void
  onCopyPath: (path: string) => void
  manual: ManualGroups
  onSetItemColor: (itemKey: string, color: string | null) => void
}) {
  const emptyLineActive = dragIndicator?.mode === 'line' && dragIndicator.row.kind === 'topLevel' && dragIndicator.row.key === topLevelRef.key
  return (
    <div
      role="group"
      aria-label={t('section.topLevel')}
      className="wgTopLevelArea"
      onDragOver={onDragOverTopLevelArea}
      onDragLeave={onDragLeaveRow}
      onDrop={onDropRow(UNCATEGORIZED_KEY, topLevelRef)}
    >
      {topLevel.length === 0 && dragging && (
        <div
          className={`wgTopLevelEmpty${emptyLineActive ? ' wgTopLevelEmptyActive' : ''}`}
          role="treeitem"
          onDragOver={onDragOverRow(topLevelRef)}
          onDragLeave={onDragLeaveRow}
          onDrop={onDropRow(UNCATEGORIZED_KEY, topLevelRef)}
        >
          <span className="wgTopLevelEmptyLine" />
        </div>
      )}
      {topLevel.map((workspace, idx) => (
        <div key={workspace.workspaceId} role="group">
          <WorkspaceRow
            node={workspace}
            t={t}
            flat
            aria-level={1}
            aria-posinset={totalGroups + idx + 1}
            aria-setsize={totalRootItems}
            onToggle={() => { onToggleWorkspace(workspace.workspaceId as string) }}
            onNewSession={() => { onNewSession(workspace.workspaceId) }}
            onRename={() => { onRenameRequest(workspace.workspaceId, workspace.label) }}
            onDelete={() => { onDeleteRequest(workspace.workspaceId, workspace.label) }}
            color={manual.colors?.[workspace.workspaceId]}
            onSetColor={(color) => { void onSetItemColor(workspace.workspaceId, color) }}
            moveTargets={moveTargetsFor(workspace.workspaceId)}
            onMoveTo={(categoryKey) => { onMoveTo(workspace.workspaceId, categoryKey) }}
            {...(dragIndicator?.mode === 'line' && dragIndicator.row.kind === 'topLevel' && dragIndicator.row.key === workspace.workspaceId
              ? { insertLine: dragIndicator.before ? 'before' : 'after' }
              : {})}
            onRowDragOver={onDragOverRow({ kind: 'topLevel', key: workspace.workspaceId })}
            onRowDragLeave={onDragLeaveRow}
            onRowDrop={onDropRow(UNCATEGORIZED_KEY, { kind: 'topLevel', key: workspace.workspaceId })}
            draggable
            onWorkspaceDragStart={onDragStartWorkspace}
          />
          {workspace.expanded && (
            <WorkspaceSessions
              sessions={workspace.sessions}
              current={current}
              now={now}
              t={t}
              ariaLevel={2}
              onOpen={onOpen}
              onSessionRename={onSessionRename}
              onSessionArchive={onSessionArchive}
              onFork={onFork}
              sessionActionBusy={sessionActionBusy}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Search body rendered as a three-level tree pruned to matched branches:
 * category folder → workspace folder → matched session row. Reuses the same row components as
 * the idle tree, so search keeps the same folder hierarchy the user is used to.
 */
function SearchBody({ list, workspaces, config, archivedSessionIds, query, remote, resultLimit, current, now, open, manual, t, startSession, onWorkspaceRename, onWorkspaceDelete, onSessionRename, onSessionFork, onSessionArchive, sessionActionBusy }: {
  list: SessionListState
  workspaces: readonly WorkspaceView[]
  config: GroupsConfig
  archivedSessionIds: readonly SessionId[]
  query: string
  remote: RemoteSearchState
  resultLimit: number
  current: SessionId | undefined
  now: number
  open: (sessionId: SessionId) => void
  manual: ManualGroups
  t: GroupsBrowserProps['t']
  startSession: (workspaceId?: WorkspaceId) => void
  onWorkspaceRename: (workspaceId: WorkspaceId, title: string) => void
  onWorkspaceDelete: (workspaceId: WorkspaceId, title: string) => void
  onSessionRename: (sessionId: SessionId, title: string) => void
  onSessionFork: (sessionId: SessionId) => void
  onSessionArchive: (sessionId: SessionId) => void
  sessionActionBusy: boolean
}) {
  const currentRemote = remote.query === query ? remote : { query, status: 'loading' as const, items: [], hasMore: false }
  const matches = useMemo(
    () => deriveSearchMatches(list, workspaces, config, query, archivedSessionIds, currentRemote, resultLimit),
    [list, workspaces, config, query, archivedSessionIds, currentRemote, resultLimit],
  )
  const searchTree = useMemo(
    () => deriveSearchGroups(list, workspaces, config, matches.matchedIds, archivedSessionIds, manual, matches.snippetsBySession),
    [list, workspaces, config, matches, archivedSessionIds, manual],
  )
  const groups = searchTree.categories
  const searchTopLevel = searchTree.topLevel
  const pending = currentRemote.status === 'loading'
  const failed = currentRemote.status === 'error'
  const totalRootItems = groups.length + searchTopLevel.length
  return (
    <div className="wgList" role="tree" aria-label={t('search.results.aria')} onKeyDown={handleTreeKeyDown} onFocusCapture={handleTreeFocus}>
      {groups.map((category, idx) => (
        <div key={category.key} role="group">
          <CategoryRow
            node={category}
            t={t}
            aria-level={1}
            aria-posinset={idx + 1}
            aria-setsize={totalRootItems}
          />
          <div role="group">
            {category.workspaces.map((workspace, wIdx) => (
              <div key={workspace.workspaceId} role="group">
                <WorkspaceRow
                  node={workspace}
                  t={t}
                  aria-level={2}
                  aria-posinset={wIdx + 1}
                  aria-setsize={category.workspaces.length}
                  onNewSession={() => { startSession(workspace.workspaceId) }}
                  onRename={() => { onWorkspaceRename(workspace.workspaceId, workspace.label) }}
                  onDelete={() => { onWorkspaceDelete(workspace.workspaceId, workspace.label) }}
                />
                <div role="group">
                  {workspace.sessions.map((session, sIdx) => (
                    <SessionRow
                      key={session.id}
                      node={session}
                      currentId={current}
                      now={now}
                      t={t}
                      aria-level={3}
                      aria-posinset={sIdx + 1}
                      aria-setsize={workspace.sessions.length}
                      onOpen={open}
                      onRename={onSessionRename}
                      onFork={onSessionFork}
                      onArchive={onSessionArchive}
                      actionBusy={sessionActionBusy}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {searchTopLevel.map((workspace, tIdx) => (
        <div key={workspace.workspaceId} role="group">
          <WorkspaceRow
            node={workspace}
            t={t}
            flat
            aria-level={1}
            aria-posinset={groups.length + tIdx + 1}
            aria-setsize={totalRootItems}
            onNewSession={() => { startSession(workspace.workspaceId) }}
            onRename={() => { onWorkspaceRename(workspace.workspaceId, workspace.label) }}
            onDelete={() => { onWorkspaceDelete(workspace.workspaceId, workspace.label) }}
          />
          <div role="group">
            {workspace.sessions.map((session, sIdx) => (
              <SessionRow
                key={session.id}
                node={session}
                currentId={current}
                now={now}
                t={t}
                aria-level={2}
                aria-posinset={sIdx + 1}
                aria-setsize={workspace.sessions.length}
                onOpen={open}
                onRename={onSessionRename}
                onFork={onSessionFork}
                onArchive={onSessionArchive}
                actionBusy={sessionActionBusy}
              />
            ))}
          </div>
        </div>
      ))}
      {pending && <div className="wgSearchStatus" role="status">{t('search.pending')}</div>}
      {failed && <div className="wgSearchStatus" role="status">{t('search.unavailable')}</div>}
      {!pending && groups.length === 0 && searchTopLevel.length === 0 && (
        <div className="wgEmpty">{t('search.noMatches')}</div>
      )}
      {matches.hasMore && (
        <div className="wgSearchStatus">{t('search.hasMore')}</div>
      )}
    </div>
  )
}
