/**
 * The workspace-groups browsing region filling the sidebar shell's
 * `sidebar.workspaces` hole: section header (title + right-aligned search +
 * add workspace), the three-level tree (category → workspace → session),
 * and the workspace/session dialogs. Wide state renders the full browser;
 * rail state renders the two region icons (search / add workspace) as 36px
 * controls on the shell's shared rail entry path, each requesting expansion
 * through the owner share.
 *
 * Data: workspaces/sessions via the framework global hooks; grouping config
 * via the host half's `/workspace-groups/config` route (refetched on mount).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  IconCloseFill14,
  IconProjectAddOutline16,
  IconSearchOutline16,
  Modal,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId, SessionListState, SessionSearchResultItem, WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'
import { classify } from '../core/matcher.ts'
import type { GroupsConfig } from '../core/types.ts'
import type { GroupsBrowserProps } from './contract.ts'
import { deriveGroups, deriveSearchGroups, deriveSearchMatches, type CategoryNode } from './tree.ts'
import { CategoryRow, SessionRow, WorkspaceRow } from './rows.tsx'
import css from './styles.css?inline'

const SEARCH_DEBOUNCE_MS = 250
const SEARCH_QUERY_MAX_CODE_UNITS = 500

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

/** Minimal fetch of the grouping config (host route; no-cache revalidation). */
async function fetchGroupsConfig(): Promise<GroupsConfig> {
  const response = await fetch('/workspace-groups/config', { cache: 'no-cache' })
  if (!response.ok) throw new Error(`config request failed: ${response.status}`)
  const body = (await response.json()) as GroupsConfig
  return Array.isArray(body.categories) ? body : { categories: [] }
}

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
  pickDirectory,
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

  // Grouping config from the host route.
  const [config, setConfig] = useState<GroupsConfig>({ categories: [] })
  const [configError, setConfigError] = useState<string | null>(null)
  const reloadConfig = () => {
    setConfigError(null)
    fetchGroupsConfig().then(setConfig).catch((reason: unknown) => {
      setConfigError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  useEffect(() => { reloadConfig() }, [])

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
    const category = categoriesForCurrent(config, workspaces, current)
    if (category !== undefined && !Object.hasOwn(categoryExpansion, category)) {
      actions.setCategoryExpanded(category, true)
    }
    if (!Object.hasOwn(workspaceExpansion, currentWorkspaceKey)) {
      actions.setWorkspaceExpanded(currentWorkspaceKey, true)
    }
  }, [current, currentWorkspaceKey, config, workspaces, categoryExpansion, workspaceExpansion, actions])

  // Drop expansion keys that no longer exist (config edits / workspace deletion).
  useEffect(() => {
    if (workspacePhase !== 'ready') return
    actions.retainKeys(
      config.categories.map(c => c.name),
      workspaces.map(w => w.workspaceId as string),
    )
  }, [actions, config, workspacePhase, workspaces])

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
  const groups = useMemo(
    () => deriveGroups(list, workspaces, archivedSessionIds, config, {
      expandedCategories,
      expandedWorkspaces,
    }),
    [list, workspaces, archivedSessionIds, config, expandedCategories, expandedWorkspaces],
  )

  // Add workspace flow: self-contained (no directory-flow hole dependency).
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addErrorOpen, setAddErrorOpen] = useState(false)
  const addWorkspace = async (): Promise<void> => {
    if (adding) return
    setAdding(true)
    setAddError(null)
    setAddErrorOpen(false)
    try {
      const path = await pickDirectory()
      if (path === null) return // cancelled
      const workspace = await createWorkspace({ path })
      startSession(workspace.workspaceId)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason)
      setAddError(message)
      setAddErrorOpen(true)
    } finally {
      setAdding(false)
    }
  }

  // Workspace rename dialog.
  const [renameTarget, setRenameTarget] = useState<{ workspaceId: WorkspaceId; currentTitle: string } | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const renameTrimmed = renameDraft.trim()
  const renameDuplicate = renameTarget !== null && renameTrimmed !== '' && renameTrimmed !== renameTarget.currentTitle
    && workspaces.some(w => w.title === renameTrimmed)
  const renameBlocked = renaming || renameTrimmed === '' || renameTarget === null
    || renameTrimmed === renameTarget.currentTitle || renameDuplicate
  const confirmRename = () => {
    if (renameBlocked || renameTarget === null) return
    setRenaming(true)
    setRenameError(null)
    renameWorkspace(renameTarget.workspaceId, renameTrimmed).then(() => {
      setRenaming(false)
      setRenameTarget(null)
    }).catch((reason: unknown) => {
      setRenaming(false)
      setRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  // Workspace delete dialog.
  const [deleteTarget, setDeleteTarget] = useState<{ workspaceId: WorkspaceId; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const confirmDelete = () => {
    if (deleting || deleteTarget === null) return
    setDeleting(true)
    setDeleteError(null)
    deleteWorkspace(deleteTarget.workspaceId).then(() => {
      setDeleting(false)
      setDeleteTarget(null)
    }).catch((reason: unknown) => {
      setDeleting(false)
      setDeleteError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  // Session rename dialog.
  const [sessionRenameTarget, setSessionRenameTarget] = useState<{ sessionId: SessionId; currentTitle: string } | null>(null)
  const [sessionRenameDraft, setSessionRenameDraft] = useState('')
  const [sessionRenaming, setSessionRenaming] = useState(false)
  const [sessionRenameError, setSessionRenameError] = useState<string | null>(null)
  const sessionRenameTrimmed = sessionRenameDraft.trim()
  const sessionRenameBlocked = sessionRenaming || sessionRenameTrimmed === '' || sessionRenameTarget === null
  const confirmSessionRename = () => {
    if (sessionRenameBlocked || sessionRenameTarget === null) return
    setSessionRenaming(true)
    setSessionRenameError(null)
    renameSession(sessionRenameTarget.sessionId, sessionRenameTrimmed).then(() => {
      setSessionRenaming(false)
      setSessionRenameTarget(null)
    }).catch((reason: unknown) => {
      setSessionRenaming(false)
      setSessionRenameError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  const onSessionRename = (sessionId: SessionId, currentTitle: string) => {
    setSessionRenameTarget({ sessionId, currentTitle })
    setSessionRenameDraft(currentTitle)
    setSessionRenameError(null)
  }

  const onSessionArchive = (sessionId: SessionId) => {
    archiveSession(sessionId).catch((reason: unknown) => {
      console.warn('session archive rejected:', reason)
    })
  }

  const now = Date.now()

  return (
    <div className={`wgRoot${wide ? '' : ' wgRail'}`}>
      <div className="wgSectionHeader">
        {wide && <span className="wgSectionLabel">{t('section.workspaces')}</span>}
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

      <div className="wgTreeBody">
        {configError !== null && (
          <div className="wgSearchStatus" role="status">{t('configUnavailable')}</div>
        )}
        {wide && normalizedQuery !== '' ? (
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
            t={t}
          />
        ) : (
          <div className="wgList" role="tree" aria-label={t('section.workspaces')}>
            {groups.length === 0 && (
              <div className="wgEmpty">{workspacePhase === 'ready' ? t('empty.noWorkspaces') : t('empty.none')}</div>
            )}
            {groups.map((category) => (
              <CategorySection
                key={category.key}
                category={category}
                current={current}
                now={now}
                t={t}
                onToggleCategory={() => { actions.setCategoryExpanded(category.key, !category.expanded) }}
                onToggleWorkspace={(key) => { actions.setWorkspaceExpanded(key, !workspaceExpansion[key]) }}
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
                onFork={forkSession}
              />
            ))}
          </div>
        )}
      </div>

      {/* Workspace rename dialog */}
      <Modal
        open={renameTarget !== null}
        onClose={() => { setRenameTarget(null) }}
        closeLabel={t('close')}
        title={t('workspace.renameTitle')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setRenameTarget(null) }}>{t('cancel')}</Button>
            <Button variant="primary" disabled={renameBlocked} onClick={confirmRename}>{t('workspace.renameConfirm')}</Button>
          </>
        )}
      >
        <input
          className="wgRenameInput"
          value={renameDraft}
          aria-label={t("workspace.renamePlaceholder")}
          autoFocus
          onChange={(e) => { setRenameDraft(e.target.value) }}
          onKeyDown={(e) => { if (e.key === "Enter") confirmRename() }}
        />
        {renameError !== null && <div className="wgAddError" role="alert">{renameError}</div>}
      </Modal>

      {/* Workspace delete dialog */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null) }}
        closeLabel={t('close')}
        title={t('workspace.deleteTitle')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setDeleteTarget(null) }}>{t('workspace.deleteCancel')}</Button>
            <Button variant="outline" disabled={deleting} onClick={confirmDelete}>{t('workspace.delete')}</Button>
          </>
        )}
      >
        <div className="wgAddError">{t('workspace.deleteConfirm')}</div>
        {deleteError !== null && <div className="wgAddError" role="alert">{deleteError}</div>}
      </Modal>

      {/* Session rename dialog */}
      <Modal
        open={sessionRenameTarget !== null}
        onClose={() => { setSessionRenameTarget(null) }}
        closeLabel={t('close')}
        title={t('session.renameTitle')}
        footer={(
          <>
            <Button variant="outline" onClick={() => { setSessionRenameTarget(null) }}>{t('session.renameCancel')}</Button>
            <Button variant="primary" disabled={sessionRenameBlocked} onClick={confirmSessionRename}>{t('session.renameConfirm')}</Button>
          </>
        )}
      >
        <input
          className="wgRenameInput"
          value={sessionRenameDraft}
          aria-label={t("session.renamePlaceholder")}
          autoFocus
          onChange={(e) => { setSessionRenameDraft(e.target.value) }}
          onKeyDown={(e) => { if (e.key === "Enter") confirmSessionRename() }}
        />
        {sessionRenameError !== null && <div className="wgAddError" role="alert">{sessionRenameError}</div>}
      </Modal>

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
): string | undefined {
  const workspace = workspaces.find(w => w.sessionIds.includes(current))
  if (workspace === undefined) return undefined
  return classify(config.categories, workspace.path, workspace.title)?.name
}

/** One category section: header row + expanded workspace folders. */
function CategorySection({ category, current, now, t, onToggleCategory, onToggleWorkspace, onNewSession, onOpen, onRenameRequest, onDeleteRequest, onSessionRename, onSessionArchive, onFork }: {
  category: CategoryNode
  current: SessionId | undefined
  now: number
  t: GroupsBrowserProps['t']
  onToggleCategory: () => void
  onToggleWorkspace: (key: string) => void
  onNewSession: (workspaceId?: WorkspaceId) => void
  onOpen: (sessionId: SessionId) => void
  onRenameRequest: (workspaceId: WorkspaceId, currentTitle: string) => void
  onDeleteRequest: (workspaceId: WorkspaceId, title: string) => void
  onSessionRename: (sessionId: SessionId, currentTitle: string) => void
  onSessionArchive: (sessionId: SessionId) => void
  onFork: (sessionId: SessionId) => void
}) {
  return (
    <div role="group">
      <CategoryRow node={category} t={t} onToggle={onToggleCategory} />
      {category.expanded && (
        <div role="group">
          {category.workspaces.map((workspace) => (
            <div key={workspace.workspaceId} role="group">
              <WorkspaceRow
                node={workspace}
                t={t}
                onToggle={() => { onToggleWorkspace(workspace.workspaceId as string) }}
                onNewSession={() => { onNewSession(workspace.workspaceId) }}
                onRename={() => { onRenameRequest(workspace.workspaceId, workspace.label) }}
                onDelete={() => { onDeleteRequest(workspace.workspaceId, workspace.label) }}
              />
              {workspace.expanded && workspace.sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  node={session}
                  currentId={current}
                  now={now}
                  t={t}
                  onOpen={onOpen}
                  onRename={onSessionRename}
                  onFork={onFork}
                  onArchive={onSessionArchive}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Search body rendered as a three-level tree pruned to matched branches:
 * 分类文件夹 → 项目文件夹 → 命中会话行. Reuses the same row components as
 * the idle tree, so search keeps the same folder hierarchy the user is used to.
 */
function SearchBody({ list, workspaces, config, archivedSessionIds, query, remote, resultLimit, current, now, open, t }: {
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
  t: GroupsBrowserProps['t']
}) {
  const currentRemote = remote.query === query ? remote : { query, status: 'loading' as const, items: [], hasMore: false }
  const matches = useMemo(
    () => deriveSearchMatches(list, workspaces, config, query, archivedSessionIds, currentRemote, resultLimit),
    [list, workspaces, config, query, archivedSessionIds, currentRemote, resultLimit],
  )
  const groups = useMemo(
    () => deriveSearchGroups(list, workspaces, config, matches.matchedIds, archivedSessionIds, matches.snippetsBySession),
    [list, workspaces, config, matches, archivedSessionIds],
  )
  const pending = currentRemote.status === 'loading'
  const failed = currentRemote.status === 'error'
  return (
    <div className="wgList" role="tree" aria-label={t('search.results.aria')}>
      {groups.map((category) => (
        <div key={category.key} role="group">
          <CategoryRow node={category} t={t} onToggle={() => {}} />
          <div role="group">
            {category.workspaces.map((workspace) => (
              <div key={workspace.workspaceId} role="group">
                <WorkspaceRow
                  node={workspace}
                  t={t}
                  onToggle={() => {}}
                  onNewSession={() => {}}
                  onRename={() => {}}
                  onDelete={() => {}}
                />
                <div role="group">
                  {workspace.sessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      node={session}
                      currentId={current}
                      now={now}
                      t={t}
                      onOpen={open}
                      onRename={() => {}}
                      onFork={() => {}}
                      onArchive={() => {}}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {pending && <div className="wgSearchStatus" role="status">{t('search.pending')}</div>}
      {failed && <div className="wgSearchStatus" role="status">{t('search.unavailable')}</div>}
      {!pending && groups.length === 0 && (
        <div className="wgEmpty">{t('search.noMatches')}</div>
      )}
      {matches.hasMore && (
        <div className="wgSearchStatus">{t('search.hasMore')}</div>
      )}
    </div>
  )
}
