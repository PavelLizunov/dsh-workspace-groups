import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Button,
  IconChevronRightOutline14,
  IconFolderClose16,
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
  const requestSeq = useRef(0)
  const openGeneration = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const currentPath = useRef<string | undefined>(undefined)

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
    setSelected(null)
    listDirectory(path, nextController.signal).then((next) => {
      if (seq !== requestSeq.current || generation !== openGeneration.current) return
      setListing(next)
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
    if (listing === null || name === '' || creating || busy) return
    const generation = openGeneration.current
    setCreating(true)
    setError(null)
    createDirectory(listing.path, name).then((createdPath) => {
      if (generation !== openGeneration.current) return
      setCreating(false)
      setFolderDraft(null)
      setSelected(null)
      navigate(createdPath)
    }, (reason) => {
      if (generation !== openGeneration.current) return
      setCreating(false)
      setError(failureText(reason))
    })
  }

  const targetPath = selected?.path ?? listing?.path
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
          <Button variant="primary" disabled={targetPath === undefined || loading || busy || creating} onClick={() => { if (targetPath !== undefined) onPick(targetPath) }}>{strings.open}</Button>
        </>
      )}
    >
      <div className="wgDirectoryBrowser">
        <div className="wgDirectoryCrumbs" aria-label={strings.title}>
          {(listing?.crumbs ?? []).map((crumb, index) => (
            <span key={crumb.path} className="wgDirectoryCrumbPart">
              {index > 0 && <IconChevronRightOutline14 size={12} />}
              <button type="button" disabled={busy || creating || crumb.path === listing?.path} onClick={() => { navigate(crumb.path) }}>
                {index === 0 ? strings.home : crumb.name}
              </button>
            </span>
          ))}
        </div>

        {loading && listing === null && <div className="wgDirectoryStatus" role="status">{strings.loading}</div>}
        {error !== null && (
          <div className="wgDirectoryError" role="alert">
            <span>{error}</span>
            <Button variant="outline" disabled={loading || busy} onClick={() => { navigate(currentPath.current) }}>{strings.retry}</Button>
          </div>
        )}

        {listing !== null && (
          <div className="wgDirectoryList" role="listbox" aria-label={listing.path}>
            {listing.entries.map(entry => (
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

        {listing !== null && folderDraft === null && (
          <button type="button" className="wgDirectoryNewFolder" disabled={busy || creating} onClick={() => { setFolderDraft('') }}>{strings.newFolder}</button>
        )}
        {folderDraft !== null && (
          <div className="wgDirectoryCreate">
            <input
              value={folderDraft}
              aria-label={strings.folderName}
              placeholder={strings.folderName}
              autoFocus
              disabled={busy || creating}
              onChange={event => { setFolderDraft(event.target.value) }}
              onKeyDown={event => { if (event.key === 'Enter') createFolder(); if (event.key === 'Escape') setFolderDraft(null) }}
            />
            <Button variant="outline" disabled={busy || creating} onClick={() => { setFolderDraft(null) }}>{strings.cancel}</Button>
            <Button variant="primary" disabled={busy || creating || folderDraft.trim() === ''} onClick={createFolder}>{strings.create}</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
