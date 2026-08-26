import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  IconChevronRightOutline14,
  IconEditOutline16,
  IconFolderClose16,
  IconRefreshOutline14,
  IconWarningOutline16,
  Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { DirectoryEntry, DirectoryListing } from '@deepseek-ai/dsh-client-runtime/client'
import css from './directory-browser.css?inline'

export interface DirectoryBrowserStrings {
  title: string
  home: string
  newFolder: string
  folderName: string
  create: string
  cancel: string
  open: string
  loading: string
  retry: string
  showHidden?: string
  truncated?: string
  pathPlaceholder?: string
  go?: string
  refresh?: string
}

export interface DirectoryBrowserProps {
  open: boolean
  busy: boolean
  listDirectory: (path?: string, signal?: AbortSignal) => Promise<DirectoryListing>
  createDirectory: (path: string, name: string) => Promise<string>
  onPick: (path: string) => void
  onClose: () => void
  strings: DirectoryBrowserStrings
}

export interface FormattedCrumb {
  path: string
  name: string
  isHome: boolean
}

export function filterDirectoryEntries(entries: DirectoryEntry[], showHidden: boolean): DirectoryEntry[] {
  if (showHidden) return entries
  return entries.filter(entry => !entry.hidden && !entry.name.startsWith('.'))
}

export function formatCrumbs(
  crumbs: DirectoryEntry[] = [],
  homePath?: string,
  homeLabel: string = 'Home'
): FormattedCrumb[] {
  return crumbs.map((crumb, index) => {
    const isHome = Boolean(homePath && crumb.path === homePath)
    let name = crumb.name
    if (isHome) {
      name = homeLabel
    } else if (index === 0) {
      if (!homePath || homePath === '/') {
        name = homeLabel
      } else if (!name) {
        name = '/'
      }
    } else if (!name) {
      name = '/'
    }
    return {
      path: crumb.path,
      name,
      isHome,
    }
  })
}

export function resolveNewFolderTarget(selectedPath?: string, listingPath?: string): string | undefined {
  return selectedPath ?? listingPath
}

export function isImeComposing(event: React.KeyboardEvent): boolean {
  return Boolean(event.nativeEvent?.isComposing || (event as unknown as { isComposing?: boolean }).isComposing)
}

function failureText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

export function DirectoryBrowser({ open, busy, listDirectory, createDirectory, onPick, onClose, strings }: DirectoryBrowserProps) {
  const [listing, setListing] = useState<DirectoryListing | null>(null)
  const [selected, setSelected] = useState<DirectoryEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [folderDraft, setFolderDraft] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [restoreNewFolderFocus, setRestoreNewFolderFocus] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [editingPath, setEditingPath] = useState(false)
  const [pathInput, setPathInput] = useState('')

  const requestSeq = useRef(0)
  const openGeneration = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const currentPath = useRef<string | undefined>(undefined)

  const pathInputRef = useRef<HTMLInputElement | null>(null)
  const newFolderInputRef = useRef<HTMLInputElement | null>(null)
  const newFolderBtnRef = useRef<HTMLButtonElement | null>(null)
  const editPathBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-plugin', 'dsh-workspace-groups-directory-browser')
    style.textContent = css
    document.head.append(style)
    return () => { style.remove() }
  }, [])

  const navigate = useCallback((path?: string) => {
    controller.current?.abort()
    const nextController = new AbortController()
    controller.current = nextController
    currentPath.current = path
    const seq = ++requestSeq.current
    const generation = openGeneration.current
    setLoading(true)
    setError(null)
    setListing(null)
    setSelected(null)
    listDirectory(path, nextController.signal).then((next) => {
      if (seq !== requestSeq.current || generation !== openGeneration.current) return
      setListing(next)
      setPathInput(next.path)
      setLoading(false)
    }, (reason) => {
      if (nextController.signal.aborted || seq !== requestSeq.current || generation !== openGeneration.current) return
      setLoading(false)
      setError(failureText(reason))
    })
  }, [listDirectory])

  useEffect(() => {
    openGeneration.current += 1
    if (open) {
      setListing(null)
      setSelected(null)
      setFolderDraft(null)
      setError(null)
      setEditingPath(false)
      setPathInput('')
      navigate()
      return
    }
    requestSeq.current += 1
    controller.current?.abort()
    controller.current = null
    setLoading(false)
    setCreating(false)
  }, [open, navigate])

  useEffect(() => () => {
    requestSeq.current += 1
    openGeneration.current += 1
    controller.current?.abort()
  }, [])

  useEffect(() => {
    if (editingPath) {
      pathInputRef.current?.focus()
      pathInputRef.current?.select()
    }
  }, [editingPath])

  useEffect(() => {
    if (folderDraft !== null) newFolderInputRef.current?.focus()
    if (folderDraft === null && restoreNewFolderFocus) {
      newFolderBtnRef.current?.focus()
      setRestoreNewFolderFocus(false)
    }
  }, [folderDraft, restoreNewFolderFocus])

  const close = () => {
    if (busy || creating) return
    requestSeq.current += 1
    openGeneration.current += 1
    controller.current?.abort()
    controller.current = null
    onClose()
  }

  const createFolder = () => {
    const name = folderDraft?.trim() ?? ''
    const targetPath = resolveNewFolderTarget(selected?.path, listing?.path)
    if (targetPath === undefined || name === '' || creating || busy) return
    const generation = openGeneration.current
    setCreating(true)
    setError(null)
    createDirectory(targetPath, name).then((createdPath) => {
      if (generation !== openGeneration.current) return
      setCreating(false)
      setRestoreNewFolderFocus(true)
      setFolderDraft(null)
      setSelected(null)
      navigate(createdPath)
    }, (reason) => {
      if (generation !== openGeneration.current) return
      setCreating(false)
      setError(failureText(reason))
    })
  }

  const handlePathSubmit = () => {
    const trimmed = pathInput.trim()
    if (trimmed !== '') {
      setEditingPath(false)
      navigate(trimmed)
      editPathBtnRef.current?.focus()
    }
  }

  const targetPath = selected?.path ?? listing?.path
  const visibleEntries = filterDirectoryEntries(listing?.entries ?? [], showHidden)
  const formattedCrumbs = formatCrumbs(listing?.crumbs, listing?.home, strings.home)

  return (
    <Modal
      open={open}
      onClose={close}
      closeLabel={strings.cancel}
      title={strings.title}
      className="wgDirectoryDialog"
      footer={(
        <>
          <Button variant="outline" disabled={busy || creating} onClick={close}>{strings.cancel}</Button>
          <Button variant="primary" disabled={targetPath === undefined || error !== null || loading || busy || creating} onClick={() => { if (targetPath !== undefined) onPick(targetPath) }}>{strings.open}</Button>
        </>
      )}
    >
      <div className="wgDirectoryBrowser">
        <div className="wgDirectoryToolbar">
          {editingPath ? (
            <div className="wgDirectoryPathEdit">
              <input
                ref={pathInputRef}
                className="wgDirectoryPathInput"
                value={pathInput}
                placeholder={strings.pathPlaceholder ?? 'Enter path…'}
                disabled={busy || creating || loading}
                onChange={e => setPathInput(e.target.value)}
                onKeyDown={e => {
                  if (isImeComposing(e)) return
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handlePathSubmit()
                  } else if (e.key === 'Escape') {
                    setEditingPath(false)
                    editPathBtnRef.current?.focus()
                  }
                }}
              />
              <Button
                variant="primary"
                disabled={busy || creating || loading || pathInput.trim() === ''}
                onClick={handlePathSubmit}
              >
                {strings.go ?? 'Go'}
              </Button>
              <Button
                variant="outline"
                disabled={busy || creating}
                onClick={() => {
                  setEditingPath(false)
                  editPathBtnRef.current?.focus()
                }}
              >
                {strings.cancel}
              </Button>
            </div>
          ) : (
            <div className="wgDirectoryCrumbs" aria-label={strings.title}>
              {formattedCrumbs.map((crumb, index) => (
                <span key={crumb.path} className="wgDirectoryCrumbPart">
                  {index > 0 && <IconChevronRightOutline14 size={12} />}
                  <button
                    type="button"
                    disabled={busy || creating || crumb.path === listing?.path}
                    onClick={() => { navigate(crumb.path) }}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>
          )}

          {!editingPath && (
            <div className="wgDirectoryToolbarActions">
              <button
                ref={editPathBtnRef}
                type="button"
                className="wgDirectoryIconButton"
                title="Edit path"
                aria-label="Edit path"
                disabled={busy || creating || loading}
                onClick={() => {
                  setPathInput(listing?.path ?? currentPath.current ?? '')
                  setEditingPath(true)
                }}
              >
                <IconEditOutline16 size={14} />
              </button>

              <button
                type="button"
                className="wgDirectoryIconButton"
                title={strings.refresh ?? 'Refresh'}
                aria-label={strings.refresh ?? 'Refresh'}
                disabled={busy || creating || loading}
                onClick={() => { navigate(currentPath.current ?? listing?.path) }}
              >
                <IconRefreshOutline14 size={14} />
              </button>
            </div>
          )}
        </div>

        {loading && listing === null && <div className="wgDirectoryStatus" role="status">{strings.loading}</div>}
        {error !== null && (
          <div className="wgDirectoryError" role="alert">
            <span>{error}</span>
            <Button variant="outline" disabled={loading || busy} onClick={() => { navigate(currentPath.current ?? listing?.path) }}>{strings.retry}</Button>
          </div>
        )}

        {listing !== null && listing.truncated && (
          <div className="wgDirectoryTruncated" role="status">
            <IconWarningOutline16 size={14} />
            <span>{strings.truncated ?? 'Listing truncated — too many directory entries'}</span>
          </div>
        )}

        {listing !== null && (
          <div className="wgDirectoryList" role="listbox" aria-label={listing.path}>
            {visibleEntries.map(entry => (
              <button
                key={entry.path}
                type="button"
                role="option"
                aria-selected={selected?.path === entry.path}
                className={`wgDirectoryRow${selected?.path === entry.path ? ' wgDirectoryRowSelected' : ''}`}
                disabled={busy || creating}
                onClick={() => { setSelected(entry) }}
                onDoubleClick={() => { navigate(entry.path) }}
              >
                <IconFolderClose16 size={16} />
                <span>{entry.name}</span>
                <IconChevronRightOutline14 size={12} />
              </button>
            ))}
          </div>
        )}

        <div className="wgDirectoryBottomBar">
          {listing !== null && folderDraft === null && (
            <button
              ref={newFolderBtnRef}
              type="button"
              className="wgDirectoryNewFolder"
              disabled={busy || creating}
              onClick={() => { setFolderDraft('') }}
            >
              {strings.newFolder}
            </button>
          )}

          {listing !== null && (
            <label className="wgDirectoryHiddenToggle">
              <input
                type="checkbox"
                checked={showHidden}
                disabled={busy || creating}
                onChange={e => setShowHidden(e.target.checked)}
              />
              <span>{strings.showHidden ?? 'Show hidden'}</span>
            </label>
          )}
        </div>

        {folderDraft !== null && (
          <div className="wgDirectoryCreate">
            <input
              ref={newFolderInputRef}
              value={folderDraft}
              aria-label={strings.folderName}
              placeholder={strings.folderName}
              disabled={busy || creating}
              onChange={event => { setFolderDraft(event.target.value) }}
              onKeyDown={event => {
                if (isImeComposing(event)) return
                if (event.key === 'Enter') {
                  event.preventDefault()
                  createFolder()
                } else if (event.key === 'Escape') {
                  setRestoreNewFolderFocus(true)
                  setFolderDraft(null)
                }
              }}
            />
            <Button
              variant="outline"
              disabled={busy || creating}
              onClick={() => {
                setRestoreNewFolderFocus(true)
                setFolderDraft(null)
              }}
            >
              {strings.cancel}
            </Button>
            <Button
              variant="primary"
              disabled={busy || creating || folderDraft.trim() === ''}
              onClick={createFolder}
            >
              {strings.create}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
