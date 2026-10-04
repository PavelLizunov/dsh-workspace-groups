import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconChevronDownOutline14, IconChevronLeftOutline14, IconChevronRightOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import { ScopeIcon, type ScopeOption } from './ScopeFilter.tsx'
import type { T } from './row-utils.ts'

export interface WorkspaceChoice extends ScopeOption { groupKey: string }

/** Two levels in one anchored popup; drilling is not selection or navigation. */
export function WorkspaceNavigator({ groups, workspaces, groupKey, workspaceId, onScope, onNavigate, t }: {
  groups: readonly ScopeOption[]
  workspaces: readonly WorkspaceChoice[]
  groupKey: string
  workspaceId: string
  onScope: (groupKey: string, workspaceId: string) => void
  onNavigate: (workspace: WorkspaceChoice) => Promise<void>
  t: T
}) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 400 })
  const search = useRef<HTMLInputElement | null>(null)
  const body = useRef<HTMLDivElement | null>(null)
  const attempt = useRef(0)
  const navigatePending = useRef(false)
  const selectedGroup = groups.find(group => group.id === groupKey)
  const selectedWorkspace = workspaces.find(workspace => workspace.id === workspaceId)
  const selected = selectedWorkspace ?? selectedGroup ?? { id: '', label: t('filter.project.all') }
  const currentGroup = groups.find(group => group.id === level)
  const needle = query.trim().toLocaleLowerCase()
  const matches = (label: string) => needle === '' || label.toLocaleLowerCase().includes(needle)
  const shownGroups = level === null ? groups.filter(group => matches(group.label)) : []
  const shownWorkspaces = workspaces.filter(workspace => (level === null ? needle !== '' : workspace.groupKey === level) && matches(workspace.label))
  const close = () => { if (navigatePending.current) return; attempt.current++; setOpen(false); setBusy(false) }
  useEffect(() => {
    if (!open) return
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom - 12
      const above = rect.top - 12
      const placeBelow = below >= 240 || below >= above
      const height = Math.max(80, Math.min(430, placeBelow ? below : above))
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 312)), top: placeBelow ? rect.bottom + 4 : Math.max(12, rect.top - height - 4), maxHeight: height })
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !body.current?.contains(event.target)) close()
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !navigatePending.current) { event.preventDefault(); close(); trigger.current?.focus() } }
    place(); search.current?.focus()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])
  useEffect(() => { if (open) search.current?.focus() }, [level])
  const drill = (key: string | null) => { setLevel(key); setQuery(''); setError(null) }
  const chooseScope = (key: string) => { onScope(key, ''); close() }
  const navigate = async (workspace: WorkspaceChoice) => {
    if (navigatePending.current) return
    navigatePending.current = true
    const id = ++attempt.current
    setBusy(true); setError(null)
    try {
      await onNavigate(workspace)
      if (attempt.current === id) { setOpen(false); setBusy(false); trigger.current?.focus() }
    } catch (reason: unknown) {
      if (attempt.current === id) {
        setError(reason instanceof Error ? reason.message : t('navigator.error'))
        setBusy(false)
      }
    } finally { navigatePending.current = false }
  }
  return <div className="wgScopeMenu">
    <button ref={trigger} type="button" className={`wgScopeFilter${groupKey !== '' || workspaceId !== '' ? ' wgScopeFilterActive' : ''}`}
      data-wg-workspace-navigator aria-label={`${t('navigator.title')}: ${selected.label}`} aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { if (open) close(); else { drill(null); setOpen(true) } }}>
      <ScopeIcon option={selected} />
      <span className="wgNavigatorTriggerLabel">{selectedWorkspace && selectedGroup && <span className="wgNavigatorBreadcrumb">{selectedGroup.label}</span>}<span className="wgScopeLabel">{selected.label}</span></span>
      <IconChevronDownOutline14 />
    </button>
    {open && createPortal(<div className="wgNavigatorPopup" ref={body} role="dialog" aria-label={t('navigator.title')} aria-busy={busy}
      style={{ left: position.left, top: position.top, maxHeight: position.maxHeight }}
      onKeyDown={event => {
        if (event.target instanceof HTMLInputElement) return
        if (event.key === 'ArrowLeft' && level !== null) { event.preventDefault(); drill(null); return }
        const rows = Array.from(body.current?.querySelectorAll<HTMLButtonElement>('[data-wg-picker-row]:not(:disabled)') ?? [])
        const index = rows.indexOf(document.activeElement as HTMLButtonElement)
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); rows[(index + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length]?.focus() }
        if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); rows[event.key === 'Home' ? 0 : rows.length - 1]?.focus() }
      }}><div className="wgNavigator">
      <div className="wgNavigatorHeader">
        {level !== null && <button type="button" className="wgIconButton" disabled={busy} data-wg-picker-back aria-label={t('navigator.back')} onClick={() => { drill(null) }}><IconChevronLeftOutline14 /></button>}
        <span>{currentGroup?.label ?? t('navigator.title')}</span>
      </div>
      <input ref={search} type="search" className="wgNavigatorSearch" value={query} disabled={busy}
        aria-label={t('navigator.search')} placeholder={t('navigator.search')}
        onChange={event => { setQuery(event.target.value) }}
        onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); body.current?.querySelector<HTMLButtonElement>('[data-wg-picker-row]:not(:disabled)')?.focus() } }} />
      <div className="wgNavigatorList">
        {needle === '' && <button type="button" className="wgNavigatorRow" data-wg-picker-row data-wg-picker-scope
          disabled={busy} onClick={() => { chooseScope(level ?? '') }}><ScopeIcon option={{ id: '', label: '' }} /><span>{level === null ? t('filter.project.all') : t('navigator.groupAll')}</span></button>}
        {shownGroups.map(group => <button key={`group:${group.id}`} type="button" className="wgNavigatorRow" data-wg-picker-row data-wg-picker-group={group.id}
          disabled={busy} onClick={() => { drill(group.id) }}>
          <ScopeIcon option={group} /><span className="wgScopeLabel">{group.label}</span>
          <span className="wgNavigatorCount">{workspaces.filter(workspace => workspace.groupKey === group.id).length}</span><IconChevronRightOutline14 />
        </button>)}
        {shownWorkspaces.map(workspace => <button key={`workspace:${workspace.id}`} type="button" className="wgNavigatorRow" data-wg-picker-row data-wg-picker-workspace={workspace.id}
          disabled={busy} aria-current={workspaceId === workspace.id ? 'true' : undefined} onClick={() => { void navigate(workspace) }}>
          <ScopeIcon option={workspace} /><span className="wgNavigatorRowLabel"><span className="wgScopeLabel">{workspace.label}</span>{level === null && <span className="wgNavigatorBreadcrumb">{groups.find(group => group.id === workspace.groupKey)?.label}</span>}</span>
        </button>)}
        {shownGroups.length === 0 && shownWorkspaces.length === 0 && <div className="wgNavigatorEmpty">{t('navigator.empty')}</div>}
      </div>
      {error !== null && <div className="wgNavigatorError" role="alert">{error}</div>}
      {busy && <div className="wgNavigatorEmpty" role="status">{t('navigator.opening')}</div>}
    </div></div>, document.body)}
  </div>
}
