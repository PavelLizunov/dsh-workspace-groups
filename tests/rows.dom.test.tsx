/** @vitest-environment jsdom */
import React from 'react'
import { act } from 'react'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeMocks = vi.hoisted(() => ({
  indexSubagentDescendants: vi.fn(() => new Map()),
}))
vi.mock('../src/client/subagent-lineage.ts', () => runtimeMocks)

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
  Modal: ({ children, footer, open, title }: { children?: React.ReactNode; footer?: React.ReactNode; open?: boolean; title?: React.ReactNode }) => (open ? <div data-wg-modal><div className="wgModalTitle">{title}</div>{children}{footer}</div> : null),
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  IconArchiveOutline20: () => <span />,
  IconBranchOutline16: () => <span />,
  IconCloseFill14: () => <span />,
  IconChevronDownOutline14: () => <span />,
  IconClockOutline16: () => <span />,
  IconEditOutline16: () => <span />,
  IconEllipsisOutline16: () => <span />,
  IconFolderClose16: () => <span />,
  IconFolderOpen16: () => <span />,
  IconFolderOpenOutline16: () => <span />,
  IconPlusOutline16: () => <span />,
  IconProjectAddOutline16: () => <span />,
  IconRefreshOutline14: () => <span />,
  IconSearchOutline16: () => <span />,
  IconRefreshOutline16: () => <svg data-reset-icon />,
  IconTriangleRightFill14: () => <span />,
  IconTrashOutline16: () => <span />,
  StateDot: ({ state }: { state?: string }) => <span data-state-dot={state ?? ''} />,
  Menu: ({ anchor, items, onSelect, portal, compact }: { anchor: React.ReactNode; items: Array<{ id: string; label: React.ReactNode; icon?: React.ReactNode; disabled?: boolean; submenu?: Array<{ id: string; label: React.ReactNode; icon?: React.ReactNode; disabled?: boolean }> }>; onSelect: (id: string) => void; portal?: boolean; compact?: boolean }) => (
    <div data-menu-portal={portal || undefined} data-menu-compact={compact || undefined} data-has-submenu={items.some(item => (item.submenu?.length ?? 0) > 0) || undefined}>
      {anchor}
      {items.flatMap(item => [item, ...(item.submenu ?? [])]).map(item => (
        <button key={item.id} disabled={item.disabled} onClick={() => onSelect(item.id)}>{item.icon}{item.label}</button>
      ))}
    </div>
  ),
}))

import { CategoryRow, DND_WORKSPACE_TYPE, SessionRow, WorkspaceRow, sessionDotState } from '../src/client/rows.tsx'
import { GroupsBrowser } from '../src/client/GroupsBrowser.tsx'
import { FolderIconPicker } from '../src/client/FolderIconPicker.tsx'
import { acknowledgeSessionErrorImpl, clearCompletedSessionImpl, reconcileSessionCompletionImpl, type GroupsViewState } from '../src/client/store-core.ts'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import { ATTENTION_PROJECTION_KEY } from '../src/core/attention.ts'

const emptyPending = new Map<never, never>()
const t = ((key: string) => key) as never
let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => { root.unmount() })
  host.remove()
  vi.unstubAllGlobals()
})

describe('folder icon persistence in GroupsBrowser', () => {
  it('chooses, persists, reloads and resets a workspace icon through the real handler', async () => {
    let manual: Record<string, unknown> = { categories: [], assignments: {} }
    const saves: unknown[] = []
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(init.body as string)
        manual = body.manual
        saves.push(manual)
      }
      return { ok: true, status: 200, headers: new Headers({ etag: `rev-${saves.length}` }), json: async () => ({ categories: [], manual, revision: `rev-${saves.length}` }) }
    }))
    const list = { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {} }
    const workspaces = { phase: 'ready', archivedSessionIds: [], items: [{ workspaceId: 'w1', path: '/tmp', title: 'Project', createdAt: '2026-01-01', sessionIds: [] }] }
    const view = { categoryExpansion: {}, workspaceExpansion: {} }
    const render = () => root.render(<GroupsBrowser wide expandSidebar={() => {}}
      useSessions={((select: (s: typeof list) => unknown) => select(list)) as never}
      useSessionPendingInteraction={((select: (s: typeof emptyPending) => unknown) => select(emptyPending)) as never}
      useWorkspaces={((select: (s: typeof workspaces) => unknown) => select(workspaces)) as never}
      useStore={((select: (s: typeof view) => unknown) => select(view)) as never}
      actions={{ setCategoryExpanded: () => {}, setWorkspaceExpanded: () => {}, retainKeys: () => {} } as never}
      startSession={() => {}} open={() => {}} renameSession={async () => {}} forkSession={async () => {}} renameWorkspace={async () => {}}
      deleteWorkspace={async () => {}} insertWorkspaceBefore={async () => {}} archiveSession={async () => {}}
      cleanupSessions={async () => {}} insertSessionBefore={async () => {}} createWorkspace={async () => { throw new Error('unused') }}
      listDirectory={async () => ({ path: '/tmp', entries: [], crumbs: [] }) as never} createDirectory={async () => ''}
      searchSessions={async () => ({ items: [], hasMore: false })} searchResultLimit={20} t={t} />)
    const choose = () => Array.from(host.querySelectorAll('.wgProjectRow button')).find(button => button.textContent === 'icon.title') as HTMLButtonElement
    await act(async () => { render() })
    await act(async () => { choose().click() })
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="icon.server"]')!.click() })
    expect(saves).toHaveLength(0)
    await act(async () => { Array.from(host.querySelectorAll<HTMLButtonElement>('.wgFolderColorChoices button')).find(button => button.textContent === 'color.red')!.click() })
    await act(async () => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'icon.save')!.click() })
    expect(manual.workspaceIcons).toEqual({ w1: 'server' })
    expect(manual.colors).toEqual({ w1: 'red' })
    expect(host.querySelector('.wgProjectRow [data-wg-folder-icon="server"]')).not.toBeNull()
    await act(async () => { root.unmount(); root = createRoot(host); render() })
    expect(host.querySelector('.wgProjectRow [data-wg-folder-icon="server"]')).not.toBeNull()
    await act(async () => { choose().click() })
    await act(async () => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'icon.reset')!.click() })
    await act(async () => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'icon.save')!.click() })
    expect(manual.workspaceIcons).toEqual({})
    expect(manual.colors).toEqual({ w1: 'red' })
    expect(host.querySelector('.wgProjectRow [data-wg-folder-icon]')).toBeNull()
    expect(saves).toHaveLength(2)
  })
})

describe('error acknowledgment in GroupsBrowser', () => {
  it('clears Error on click, persists after navigation/reload, and waits for ready snapshots', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, headers: new Headers({ etag: 'rev-1' }),
      json: async () => ({ categories: [], manual: { categories: [], assignments: {} } }),
    })))
    let list = {
      ids: ['s1', 's2'], current: 's1', phase: 'ready', subagentsByParent: {},
      byId: {
        s1: { id: 's1', displayTitle: 'Failed session', blank: false, running: false, completed: true, updatedAt: 1, projectionValues: { [ATTENTION_PROJECTION_KEY]: { reason: 'error' } } },
        s2: { id: 's2', displayTitle: 'Other session', blank: false, running: false, updatedAt: 1 },
      },
    } as unknown as SessionListState
    const workspaces = { phase: 'ready', archivedSessionIds: [], items: [{ workspaceId: 'w1', path: '/tmp', title: 'Project', createdAt: '2026-01-01', sessionIds: ['s1', 's2'] }] }
    let view: GroupsViewState = { categoryExpansion: {}, workspaceExpansion: { w1: true } }
    const reconcile = vi.fn((sessions, current) => {
      reconcileSessionCompletionImpl(view, sessions, current)
    })
    const actions = {
      setCategoryExpanded: () => {}, setWorkspaceExpanded: () => {}, retainKeys: () => {},
      acknowledgeSessionError: (id: string, revision: string) => acknowledgeSessionErrorImpl(view, id, revision),
      clearCompletedSession: (id: string) => clearCompletedSessionImpl(view, id),
      reconcileSessionCompletion: reconcile,
    }
    const render = () => root.render(<GroupsBrowser
      wide expandSidebar={() => {}}
      useSessions={((select: (s: SessionListState) => unknown) => select(list)) as never}
      useSessionPendingInteraction={((select: (s: typeof emptyPending) => unknown) => select(emptyPending)) as never}
      useWorkspaces={((select: (s: typeof workspaces) => unknown) => select(workspaces)) as never}
      useStore={((select: (s: GroupsViewState) => unknown) => select(view)) as never}
      actions={actions as never} startSession={() => {}}
      open={id => { list = { ...list, current: id }; render() }}
      renameSession={async () => {}} forkSession={async () => {}} renameWorkspace={async () => {}}
      deleteWorkspace={async () => {}} insertWorkspaceBefore={async () => {}} archiveSession={async () => {}}
      cleanupSessions={async () => {}} insertSessionBefore={async () => {}} createWorkspace={async () => { throw new Error('not used') }}
      listDirectory={async () => ({ path: '/tmp', entries: [], crumbs: [] }) as never}
      createDirectory={async () => ''} searchSessions={async () => ({ items: [], hasMore: false })}
      searchResultLimit={20} t={t}
    />)
    await act(async () => { render() })
    expect(host.querySelector('.wgSessionPill[data-status="error"]')).not.toBeNull()
    expect(view.acknowledgedErrors).toBeUndefined()
    view = JSON.parse(JSON.stringify(view)) as GroupsViewState
    await act(async () => { root.unmount(); root = createRoot(host); render() })
    expect(host.querySelector('.wgSessionPill[data-status="error"]')).not.toBeNull()
    expect(view.acknowledgedErrors).toBeUndefined()
    await act(async () => { host.querySelector<HTMLElement>('.wgSessionRow[aria-label^="Failed session"]')!.click() })
    expect(host.querySelector('.wgSessionPill')).toBeNull()
    expect(view.acknowledgedErrors).toEqual({ s1: '1:error' })
    list = { ...list, byId: { ...list.byId, s1: { ...list.byId['s1' as never]!, updatedAt: 2 } } } as SessionListState
    await act(async () => { render() })
    expect(host.querySelector('.wgSessionPill[data-status="error"]')).not.toBeNull()
    expect(view.acknowledgedErrors).toEqual({})
    await act(async () => { host.querySelector<HTMLElement>('.wgSessionRow[aria-label^="Failed session"]')!.click() })
    expect(host.querySelector('.wgSessionPill')).toBeNull()
    expect(view.acknowledgedErrors).toEqual({ s1: '2:error' })
    await act(async () => { host.querySelector<HTMLElement>('.wgSessionRow[aria-label^="Other session"]')!.click() })
    expect(host.querySelector('[data-state-dot="error"]')).toBeNull()
    expect(host.querySelector('[data-state-dot="done"]')).toBeNull()
    view = JSON.parse(JSON.stringify(view)) as GroupsViewState
    await act(async () => { root.unmount(); root = createRoot(host); render() })
    expect(host.querySelector('.wgSessionPill')).toBeNull()
    reconcile.mockClear()
    list = { ...list, phase: 'pending', ids: [], byId: {} } as SessionListState
    await act(async () => { render() })
    expect(reconcile).not.toHaveBeenCalled()
    expect(view.acknowledgedErrors).toEqual({ s1: '2:error' })
  })
})

describe('row interaction contracts', () => {
  it('offers labelled icon choices, selection state, reset, and busy protection', () => {
    const select = vi.fn()
    const render = (busy = false) => root.render(<FolderIconPicker open label="Project" icon="book" busy={busy} error={null} onSelect={select} onClose={() => {}} t={t} />)
    act(() => render())
    expect(host.querySelectorAll('.wgIconChoice')).toHaveLength(39)
    expect(Array.from(host.querySelectorAll('.wgIconSectionTitle')).map(x => x.textContent)).toEqual([
      'icon.group.technology', 'icon.group.voice', 'icon.group.development', 'icon.group.documents', 'icon.group.animals', 'icon.group.additional',
    ])
    act(() => { host.querySelector<HTMLButtonElement>('button[aria-label="icon.microphone"]')!.click() })
    expect(select).not.toHaveBeenCalled()
    expect(host.querySelector('[aria-label="icon.microphone"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(host.querySelector('button[aria-label="icon.book"]')?.getAttribute('aria-pressed')).toBe('false')
    act(() => { host.querySelector<HTMLButtonElement>('button[aria-label="icon.server"]')!.click() })
    expect(select).not.toHaveBeenCalled()
    const whale = host.querySelector<SVGElement>('[data-wg-folder-icon="deepseek"]')!
    expect(whale.getAttribute('fill')).toBe('currentColor')
    expect(whale.getAttribute('stroke')).toBe('none')
    act(() => { host.querySelector<HTMLButtonElement>('button[aria-label="icon.deepseek"]')!.click() })
    expect(select).not.toHaveBeenCalled()
    act(() => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'color.blue')!.click() })
    act(() => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'icon.save')!.click() })
    expect(select).toHaveBeenLastCalledWith('deepseek', 'blue')
    act(() => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'icon.reset')!.click() })
    act(() => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'icon.save')!.click() })
    expect(select).toHaveBeenLastCalledWith(null, 'blue')
    act(() => render(true))
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="icon.server"]')!.disabled).toBe(true)
  })
  it('preserves custom color and discards draft on close while keeping save errors visible', () => {
    const select = vi.fn(), close = vi.fn()
    act(() => root.render(<FolderIconPicker open label="W" icon="book" color="#abcdef" busy={false} error="Save failed" onSelect={select} onClose={close} t={t} />))
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Save failed')
    act(() => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'icon.save')!.click() })
    expect(select).toHaveBeenLastCalledWith('book', '#abcdef')
    select.mockClear()
    act(() => { host.querySelector<HTMLButtonElement>('[aria-label="icon.cat"]')!.click() })
    act(() => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'close')!.click() })
    expect(close).toHaveBeenCalledTimes(1)
    expect(select).not.toHaveBeenCalled()
  })

  it('taps folder icons to expand rows without opening the icon editor', () => {
    const choose = vi.fn()
    const toggle = vi.fn()
    act(() => root.render(<CategoryRow node={{ key: 'cat', label: 'Group', expanded: false, containsCurrent: false, workspaces: [] }}
      onChooseIcon={choose} onToggle={toggle} t={t} />))
    const groupIcon = host.querySelector<HTMLElement>('[data-wg-row-icon="group"]')!
    expect(groupIcon.tagName).toBe('SPAN')
    act(() => { groupIcon.click() })
    expect(toggle).toHaveBeenCalledTimes(1)
    expect(choose).not.toHaveBeenCalled()
    act(() => root.render(<WorkspaceRow node={{ workspaceId: 'w' as never, path: '/w', label: 'W', createdAt: 0, sessionCount: 0, expanded: false, containsCurrent: false, sessions: [] }}
      onChooseIcon={choose} onToggle={toggle} t={t} />))
    act(() => { host.querySelector<HTMLElement>('[data-wg-row-icon="project"]')!.click() })
    expect(toggle).toHaveBeenCalledTimes(2)
    expect(choose).not.toHaveBeenCalled()
    expect(host.querySelector('button[data-wg-row-icon]')).toBeNull()
  })

  it('shows chosen folder icons without hiding colors or attention and opens their picker action', () => {
    const choose = vi.fn()
    act(() => root.render(<CategoryRow node={{ key: 'cat', label: 'Group', expanded: false, containsCurrent: false, workspaces: [], attention: 'error' }}
      icon="book" color="blue" onChooseIcon={choose} t={t} />))
    expect(host.querySelector('[data-wg-folder-icon="book"]')).not.toBeNull()
    expect(host.querySelector('[data-wg-row-icon="group"]')?.getAttribute('data-color')).toBe('blue')
    expect(host.querySelector<HTMLElement>('[data-wg-row-icon="group"]')?.style.color).toBe('rgb(59, 130, 246)')
    expect(host.querySelector('.wgColorDot')).toBeNull()
    expect(host.querySelector('[data-state-dot="error"]')).not.toBeNull()
    act(() => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'icon.title')!.click() })
    expect(choose).toHaveBeenCalledTimes(1)
    act(() => root.render(<WorkspaceRow node={{ workspaceId: 'w' as never, path: '/w', label: 'W', createdAt: 0, sessionCount: 0, expanded: false, containsCurrent: false, sessions: [] }}
      icon="server" onChooseIcon={choose} t={t} />))
    expect(host.querySelector('[data-wg-folder-icon="server"]')).not.toBeNull()
    act(() => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'icon.title')!.click() })
    expect(choose).toHaveBeenCalledTimes(2)
  })

  it('shows a session dot only for pending, running, or unviewed completion states', () => {
    const idle = { running: false, runningSubagentCount: 0, completed: false }
    expect(sessionDotState(idle)).toBeUndefined()
    expect(sessionDotState({ ...idle, completed: true })).toBe('done')
    expect(sessionDotState({ ...idle, running: true })).toBe('ongoing')
    expect(sessionDotState({ ...idle, runningSubagentCount: 1 })).toBe('ongoing')
    expect(sessionDotState({ ...idle, running: true, pendingInteraction: 'approval' })).toBe('warning')
    expect(sessionDotState({ ...idle, projectionReason: 'awaiting-user' })).toBe('warning')
    expect(sessionDotState({ ...idle, projectionReason: 'error' })).toBe('error')
    expect(sessionDotState({ ...idle, projectionReason: 'interrupted' })).toBe('error')
    expect(sessionDotState({ ...idle, projectionReason: 'max-tokens' })).toBe('error')
  })

  it('renders localized pills and accessible status labels on SessionRow', () => {
    const mockT = ((key: string) => (key === 'session.statusAwaiting' ? 'Awaiting' : key === 'session.statusError' ? 'Error' : key)) as never

    // Waiting state
    act(() => {
      root.render(
        <SessionRow
          node={{ id: 's1' as never, title: 'Session 1', blank: false, running: false, runningSubagentCount: 0, completed: false, updatedAt: 0, projectionReason: 'awaiting-user' }}
          currentId={undefined}
          now={0}
          t={mockT}
          onOpen={() => {}}
        />,
      )
    })
    let row = host.querySelector('[role="treeitem"]')!
    let pill = host.querySelector('.wgSessionPill')
    expect(pill?.textContent).toBe('Awaiting')
    expect(pill?.getAttribute('data-status')).toBe('warning')
    expect(row.getAttribute('aria-label')).toBe('Session 1 (Awaiting)')

    // Error state
    act(() => {
      root.render(
        <SessionRow
          node={{ id: 's2' as never, title: 'Session 2', blank: false, running: false, runningSubagentCount: 0, completed: false, updatedAt: 0, projectionReason: 'error' }}
          currentId={undefined}
          now={0}
          t={mockT}
          onOpen={() => {}}
        />,
      )
    })
    row = host.querySelector('[role="treeitem"]')!
    pill = host.querySelector('.wgSessionPill')
    expect(pill?.textContent).toBe('Error')
    expect(pill?.getAttribute('data-status')).toBe('error')
    expect(row.getAttribute('aria-label')).toBe('Session 2 (Error)')

    // Idle/ongoing state (no pill)
    act(() => {
      root.render(
        <SessionRow
          node={{ id: 's3' as never, title: 'Session 3', blank: false, running: true, runningSubagentCount: 0, completed: false, updatedAt: 0 }}
          currentId={undefined}
          now={0}
          t={mockT}
          onOpen={() => {}}
        />,
      )
    })
    row = host.querySelector('[role="treeitem"]')!
    pill = host.querySelector('.wgSessionPill')
    expect(pill).toBeNull()
    expect(row.getAttribute('aria-label')).toBe('Session 3')
  })

  it('renders pin indicator and toggles pin/unpin action in SessionRow menu', () => {
    const onPinToggle = vi.fn()

    // Pinned session
    act(() => {
      root.render(
        <SessionRow
          node={{ id: 's-pinned' as never, title: 'Pinned Session', blank: false, running: false, runningSubagentCount: 0, completed: false, updatedAt: 0, pinned: true }}
          currentId={undefined}
          now={0}
          t={t}
          onOpen={() => {}}
          onPinToggle={onPinToggle}
        />,
      )
    })
    const row = host.querySelector('[role="treeitem"]')!
    const pinBadge = host.querySelector('.wgSessionPinned')
    expect(pinBadge).not.toBeNull()
    expect(pinBadge?.getAttribute('title')).toBe('session.pinned')
    expect(row.getAttribute('aria-label')).toBe('Pinned Session (session.pinned)')

    const unpinButton = Array.from(host.querySelectorAll('button')).find(btn => btn.textContent === 'session.unpin')
    expect(unpinButton).toBeDefined()
    act(() => {
      unpinButton?.click()
    })
    expect(onPinToggle).toHaveBeenCalledWith('s-pinned')

    // Unpinned session
    onPinToggle.mockClear()
    act(() => {
      root.render(
        <SessionRow
          node={{ id: 's-unpinned' as never, title: 'Normal Session', blank: false, running: false, runningSubagentCount: 0, completed: false, updatedAt: 0 }}
          currentId={undefined}
          now={0}
          t={t}
          onOpen={() => {}}
          onPinToggle={onPinToggle}
        />,
      )
    })
    expect(host.querySelector('.wgSessionPinned')).toBeNull()
    const pinButton = Array.from(host.querySelectorAll('button')).find(btn => btn.textContent === 'session.pin')
    expect(pinButton).toBeDefined()
    act(() => {
      pinButton?.click()
    })
    expect(onPinToggle).toHaveBeenCalledWith('s-unpinned')
  })

  it('starts a Workspace drag from the selected row, not only the first row', () => {
    const onWorkspaceDragStart = vi.fn()
    const workspace = (id: string, flat = false) => (
      <WorkspaceRow
        key={id}
        node={{ workspaceId: id as never, path: `/${id}`, label: id, createdAt: 0, sessionCount: 0, expanded: false, containsCurrent: false, sessions: [] }}
        t={t}
        flat={flat}
        draggable
        onWorkspaceDragStart={onWorkspaceDragStart}
        onNewSession={() => {}}
      />
    )
    act(() => { root.render(<>{workspace('first')}{workspace('middle')}{workspace('last', true)}</>) })
    const sources = Array.from(host.querySelectorAll<HTMLElement>('[data-wg-drag-source="workspace"]'))
    expect(sources.map(source => source.draggable)).toEqual([true, true, true])

    const setData = vi.fn()
    const dataTransfer = { setData, effectAllowed: 'none' }
    const event = new Event('dragstart', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
    act(() => { sources[1]!.dispatchEvent(event) })

    expect(setData).toHaveBeenCalledWith(DND_WORKSPACE_TYPE, 'middle')
    expect(dataTransfer.effectAllowed).toBe('move')
    expect(onWorkspaceDragStart).toHaveBeenCalledWith('middle', expect.anything())
    expect(Array.from(host.querySelectorAll<HTMLButtonElement>('button')).every(button => !button.draggable)).toBe(true)
  })

  it('fixed-expanded Search category remains focusable but does not toggle', () => {
    act(() => { root.render(<CategoryRow node={{ key: 'g', label: 'Group', expanded: true, containsCurrent: false, workspaces: [] }} t={t} />) })
    const row = host.querySelector('[role="treeitem"]') as HTMLElement
    expect(row.tabIndex).toBe(0)
    act(() => { row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
    expect(row.getAttribute('aria-expanded')).toBe('true')
  })

  it('Workspace controls invoke real callbacks and omit absent controls', () => {
    const newSession = vi.fn()
    const rename = vi.fn()
    act(() => { root.render(<WorkspaceRow node={{ workspaceId: 'w' as never, path: '/w', label: 'W', createdAt: 0, sessionCount: 0, expanded: true, containsCurrent: false, sessions: [] }} t={t} onNewSession={newSession} onRename={rename} />) })
    const buttons = Array.from(host.querySelectorAll('button'))
    const newSessionButton = buttons.find(button => button.getAttribute('aria-label')?.startsWith('session.new'))
    const renameButton = buttons.find(button => button.textContent === 'workspace.rename')
    act(() => { newSessionButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    act(() => { renameButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(newSession).toHaveBeenCalledOnce()
    expect(rename).toHaveBeenCalledOnce()
    expect(buttons.some(button => button.textContent === 'workspace.delete')).toBe(false)
  })

  it('Workspace cleanup control invokes real callback when provided', () => {
    const cleanup = vi.fn()
    act(() => {
      root.render(
        <WorkspaceRow
          node={{ workspaceId: 'w' as never, path: '/w', label: 'W', createdAt: 0, sessionCount: 0, expanded: true, containsCurrent: false, sessions: [] }}
          t={t}
          onCleanup={cleanup}
        />,
      )
    })
    const buttons = Array.from(host.querySelectorAll('button'))
    const cleanupButton = buttons.find(button => button.textContent === 'cleanup.action')
    expect(cleanupButton).toBeDefined()
    act(() => { cleanupButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('Session Fork and Archive controls are disabled while another action is busy', () => {
    act(() => { root.render(<SessionRow node={{ id: 's' as never, title: 'S', blank: false, running: false, runningSubagentCount: 0, completed: false, updatedAt: 0 }} currentId={undefined} now={0} t={t} onOpen={() => {}} onFork={() => {}} onArchive={() => {}} actionBusy />) })
    const buttons = Array.from(host.querySelectorAll('button'))
    const fork = buttons.find(button => button.textContent === 'session.fork')
    const archive = buttons.find(button => button.textContent === 'session.archive')
    expect(fork?.disabled).toBe(true)
    expect(archive?.disabled).toBe(true)
  })

  it('renders color dot badge and invokes onSetColor on menu selection', () => {
    const onSetColor = vi.fn()
    act(() => { root.render(<CategoryRow node={{ key: 'g', label: 'Group', expanded: true, containsCurrent: false, workspaces: [] }} t={t} color="red" onSetColor={onSetColor} onRename={() => {}} onDelete={() => {}} />) })
    const dot = host.querySelector('.wgColorDot')
    expect(dot?.getAttribute('data-color')).toBe('red')

    const buttons = Array.from(host.querySelectorAll('button'))
    const colorAnchor = buttons.find(button => button.getAttribute('aria-label') === 'color.title')
    const colorMenu = colorAnchor?.closest('[data-menu-portal]')
    expect(colorMenu?.getAttribute('data-menu-portal')).toBe('true')
    expect(colorMenu?.getAttribute('data-menu-compact')).toBe('true')
    expect(colorMenu?.getAttribute('data-has-submenu')).toBeNull()
    const colorOption = buttons.find(button => button.textContent === 'color.red')
    act(() => { colorOption?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(onSetColor).toHaveBeenCalledWith('red')
  })

  it('renders SessionRow color ping and invokes onSetColor from ColorMenu', () => {
    const onSetColor = vi.fn()
    act(() => {
      root.render(
        <SessionRow
          node={{ id: 's-color' as never, title: 'Important', blank: false, running: false, runningSubagentCount: 0, completed: false, updatedAt: 0, color: 'green' }}
          currentId={undefined}
          now={0}
          t={t}
          onOpen={() => {}}
          color="green"
          onSetColor={onSetColor}
        />,
      )
    })
    const dot = host.querySelector('.wgColorDot')
    expect(dot?.getAttribute('data-color')).toBe('green')
    const buttons = Array.from(host.querySelectorAll('button'))
    const colorOption = buttons.find(button => button.textContent === 'color.red')
    act(() => { colorOption?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(onSetColor).toHaveBeenCalledWith('red')
  })

  it('omits SessionRow color menu on blank sessions even when onSetColor is provided', () => {
    act(() => {
      root.render(
        <SessionRow
          node={{ id: 's-blank' as never, title: 'New Session', blank: true, running: false, runningSubagentCount: 0, completed: false, updatedAt: 0 }}
          currentId={undefined}
          now={0}
          t={t}
          onOpen={() => {}}
          onSetColor={() => {}}
        />,
      )
    })
    const buttons = Array.from(host.querySelectorAll('button'))
    expect(buttons.some(button => button.getAttribute('aria-label') === 'color.title')).toBe(false)
  })

  it('renders aggregate attention dot only when CategoryRow is collapsed', () => {
    // Collapsed with attention -> renders StateDot
    act(() => {
      root.render(
        <CategoryRow
          node={{ key: 'cat', label: 'Group', expanded: false, containsCurrent: false, workspaces: [], attention: 'warning' }}
          t={t}
        />,
      )
    })
    let dot = host.querySelector('[data-state-dot]')
    expect(dot).not.toBeNull()
    expect(dot?.getAttribute('data-state-dot')).toBe('warning')

    // Expanded with attention -> dot not rendered
    act(() => {
      root.render(
        <CategoryRow
          node={{ key: 'cat', label: 'Group', expanded: true, containsCurrent: false, workspaces: [], attention: 'warning' }}
          t={t}
        />,
      )
    })
    dot = host.querySelector('[data-state-dot]')
    expect(dot).toBeNull()

    // Collapsed without attention -> dot not rendered
    act(() => {
      root.render(
        <CategoryRow
          node={{ key: 'cat', label: 'Group', expanded: false, containsCurrent: false, workspaces: [] }}
          t={t}
        />,
      )
    })
    dot = host.querySelector('[data-state-dot]')
    expect(dot).toBeNull()
  })

  it('renders aggregate attention dot only when WorkspaceRow is collapsed and preserves color dot', () => {
    // Collapsed with attention and color -> renders both color dot and attention StateDot
    act(() => {
      root.render(
        <WorkspaceRow
          node={{ workspaceId: 'w' as never, path: '/w', label: 'W', createdAt: 0, sessionCount: 0, expanded: false, containsCurrent: false, sessions: [], attention: 'ongoing' }}
          t={t}
          color="blue"
        />,
      )
    })
    expect(host.querySelector('[data-wg-row-icon="project"]')?.getAttribute('data-color')).toBe('blue')
    expect(host.querySelector('.wgColorDot')).toBeNull()

    let stateDot = host.querySelector('[data-state-dot]')
    expect(stateDot).not.toBeNull()
    expect(stateDot?.getAttribute('data-state-dot')).toBe('ongoing')

    // Expanded with attention -> attention StateDot not rendered, color dot remains
    act(() => {
      root.render(
        <WorkspaceRow
          node={{ workspaceId: 'w' as never, path: '/w', label: 'W', createdAt: 0, sessionCount: 0, expanded: true, containsCurrent: false, sessions: [], attention: 'ongoing' }}
          t={t}
          color="blue"
        />,
      )
    })
    expect(host.querySelector('[data-wg-row-icon="project"]')?.getAttribute('data-color')).toBe('blue')
    expect(host.querySelector('.wgColorDot')).toBeNull()
    stateDot = host.querySelector('[data-state-dot]')
    expect(stateDot).toBeNull()
  })

  it('renders wide-mode status scope bar and filter controls in GroupsBrowser', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ categories: [] }),
      headers: new Headers(),
    }))

    const useSessions = vi.fn((selector) => selector({
      ids: ['s1'],
      byId: { s1: { id: 's1', displayTitle: 'S1', blank: false, running: true, updatedAt: Date.now() } },
      current: undefined,
    }))
    const useWorkspaces = vi.fn((selector) => selector({
      items: [{ workspaceId: 'w1', path: '/w1', title: 'W1', createdAt: '2026-01-01', sessionIds: ['s1'] }],
      phase: 'ready',
      archivedSessionIds: [],
    }))
    const useStore = vi.fn((selector) => selector({ categoryExpansion: {}, workspaceExpansion: {} }))
    const setWorkspaceExpanded = vi.fn()

    await act(async () => {
      root.render(
        <GroupsBrowser
          wide={true}
          expandSidebar={() => {}}
          useSessions={useSessions as never}
          useSessionPendingInteraction={((selector: (value: Map<never, never>) => unknown) => selector(emptyPending)) as never}
          useWorkspaces={useWorkspaces as never}
          useStore={useStore as never}
          actions={{ setCategoryExpanded: () => {}, setWorkspaceExpanded, retainKeys: () => {} } as never}
          startSession={async () => {}}
          open={() => {}}
          renameSession={async () => {}}
          forkSession={async () => {}}
          renameWorkspace={async () => {}}
          deleteWorkspace={async () => {}}
          insertWorkspaceBefore={async () => {}}
          archiveSession={async () => {}}
          cleanupSessions={async () => {}}
          insertSessionBefore={async () => {}}
          createWorkspace={async () => ({} as never)}
          listDirectory={async () => ({} as never)}
          createDirectory={async () => ''}
          searchSessions={async () => ({ items: [], hasMore: false })}
          searchResultLimit={20}
          t={((key: string) => key) as never}
        />,
      )
    })

    const statusScopeBar = host.querySelector('.wgStatusScopeBar[role="group"]')
    expect(statusScopeBar).not.toBeNull()
    const scopes = Array.from(host.querySelectorAll('.wgStatusScopeBtn'))
    expect(scopes.length).toBe(4)
    expect(scopes[0]?.textContent).toContain('filter.all')
    expect(scopes[1]?.textContent).toContain('filter.attention')
    expect(scopes[2]?.textContent).toContain('filter.running')
    expect(scopes[3]?.textContent).toContain('filter.new')
    const filterTrigger = host.querySelector('[data-wg-filter-color]')
    expect(filterTrigger).not.toBeNull()
    const filterMenu = filterTrigger?.closest('[data-menu-portal]')
    expect(filterMenu?.getAttribute('data-menu-portal')).toBe('true')
    expect(filterMenu?.getAttribute('data-menu-compact')).toBe('true')
    expect(filterMenu?.hasAttribute('data-has-submenu')).toBe(false)

    // Click on Running scope
    await act(async () => {
      scopes[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(scopes[2]?.getAttribute('aria-pressed')).toBe('true')
    const filteredWorkspace = host.querySelector('.wgProjectRow')
    expect(filteredWorkspace?.getAttribute('aria-expanded')).toBe('false')
    await act(async () => {
      filteredWorkspace?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(host.querySelector('.wgProjectRow')?.getAttribute('aria-expanded')).toBe('true')
    expect(setWorkspaceExpanded).not.toHaveBeenCalled()

    const summary = host.querySelector('.wgFilterSummary')
    expect(summary).not.toBeNull()

    const resetBtn = host.querySelector('.wgFilterResetBtn')
    expect(resetBtn).not.toBeNull()
    expect(resetBtn?.querySelector('[data-reset-icon]')).not.toBeNull()
    expect(resetBtn?.closest('.wgFilterSummaryHeader')).not.toBeNull()
    expect(host.querySelectorAll('.wgFilterResetBtn')).toHaveLength(1)
    expect(host.querySelector('.wgEmptyReset')).toBeNull()
    expect(filterTrigger?.getAttribute('aria-haspopup')).toBe('menu')

    // Reset filter
    await act(async () => {
      resetBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(scopes[0]?.getAttribute('aria-pressed')).toBe('true')
    expect(host.querySelector('.wgFilterSummary')).toBeNull()
    expect(document.activeElement).toBe(host.querySelector('.wgStatusScopeBtn'))

    vi.unstubAllGlobals()
  })

  it('supports roving tabindex and arrow keyboard navigation on main tree', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/workspace-groups/config')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ categories: [{ key: 'work', label: 'Work', rules: [] }], manual: { categories: ['work'], assignments: { 'ws-1': 'work' } } }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve({}) })
    })
    vi.stubGlobal('fetch', fetchMock)

    const useSessions = vi.fn((selector) => selector({
      ids: ['s1'],
      byId: { s1: { id: 's1', displayTitle: 'S1', blank: false, running: true, updatedAt: Date.now() } },
      current: undefined,
    }))
    const useWorkspaces = vi.fn((selector) => selector({
      items: [{ workspaceId: 'w1', path: '/w1', title: 'W1', createdAt: '2026-01-01', sessionIds: ['s1'] }],
      phase: 'ready',
      archivedSessionIds: [],
    }))
    const useStore = vi.fn((selector) => selector({ categoryExpansion: { work: true }, workspaceExpansion: {} }))

    await act(async () => {
      root.render(
        <GroupsBrowser
          wide={true}
          expandSidebar={() => {}}
          useSessions={useSessions as never}
          useSessionPendingInteraction={((selector: (value: Map<never, never>) => unknown) => selector(emptyPending)) as never}
          useWorkspaces={useWorkspaces as never}
          useStore={useStore as never}
          actions={{ setCategoryExpanded: () => {}, setWorkspaceExpanded: () => {}, retainKeys: () => {} } as never}
          startSession={async () => {}}
          open={() => {}}
          renameSession={async () => {}}
          forkSession={async () => {}}
          renameWorkspace={async () => {}}
          deleteWorkspace={async () => {}}
          insertWorkspaceBefore={async () => {}}
          archiveSession={async () => {}}
          cleanupSessions={async () => {}}
          insertSessionBefore={async () => {}}
          createWorkspace={async () => ({} as never)}
          listDirectory={async () => ({} as never)}
          createDirectory={async () => ''}
          searchSessions={async () => ({ items: [], hasMore: false })}
          searchResultLimit={20}
          t={((key: string) => key) as never}
        />,
      )
    })

    const tree = host.querySelector('.wgList[role="tree"]')
    expect(tree).not.toBeNull()
    const treeItems = Array.from(tree!.querySelectorAll<HTMLElement>('[role="treeitem"]'))
    expect(treeItems.length).toBeGreaterThan(0)

    act(() => {
      treeItems[0]!.focus()
      treeItems[0]!.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    })

    act(() => {
      treeItems[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })

    if (treeItems.length > 1) {
      expect(treeItems[1]!.getAttribute('tabindex')).toBe('0')
      expect(treeItems[0]!.getAttribute('tabindex')).toBe('-1')
    }
  })

  it('CategoryRow supports Option/Alt-click on disclosure chevron vs ordinary toggle', () => {
    const onToggle = vi.fn()
    const onExpandEntire = vi.fn()
    const onCollapseEntire = vi.fn()

    // Test collapsed node (expanded: false)
    act(() => {
      root.render(
        <CategoryRow
          node={{ key: 'cat1', label: 'Category 1', expanded: false, containsCurrent: false, workspaces: [] }}
          t={t}
          onToggle={onToggle}
          onExpandEntire={onExpandEntire}
          onCollapseEntire={onCollapseEntire}
        />,
      )
    })

    const categoryRow = host.querySelector<HTMLElement>('.wgCategoryRow')!
    const chevron = host.querySelector<HTMLElement>('.wgChevron')!

    // 1. Ordinary row click -> calls onToggle, not onExpandEntire
    act(() => {
      categoryRow.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onExpandEntire).not.toHaveBeenCalled()

    onToggle.mockClear()

    // 2. Click on label with Alt -> ordinary single-node toggle
    const label = host.querySelector<HTMLElement>('.wgCategoryLabel')!
    act(() => {
      label.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }))
    })
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onExpandEntire).not.toHaveBeenCalled()

    onToggle.mockClear()

    // 3. Option/Alt-click specifically on disclosure chevron when collapsed -> calls onExpandEntire
    act(() => {
      chevron.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }))
    })
    expect(onExpandEntire).toHaveBeenCalledTimes(1)
    expect(onToggle).not.toHaveBeenCalled()

    // 4. Test expanded node (expanded: true)
    act(() => {
      root.render(
        <CategoryRow
          node={{ key: 'cat1', label: 'Category 1', expanded: true, containsCurrent: false, workspaces: [] }}
          t={t}
          onToggle={onToggle}
          onExpandEntire={onExpandEntire}
          onCollapseEntire={onCollapseEntire}
        />,
      )
    })

    const chevronOpen = host.querySelector<HTMLElement>('.wgChevron')!
    act(() => {
      chevronOpen.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }))
    })
    expect(onCollapseEntire).toHaveBeenCalledTimes(1)

    act(() => {
      root.render(
        <CategoryRow
          node={{ key: 'cat1', label: 'Category 1', expanded: false, containsCurrent: false, workspaces: [] }}
          t={t}
          onToggle={onToggle}
        />,
      )
    })
    act(() => {
      host.querySelector<HTMLElement>('.wgChevron')?.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }))
    })
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('CategoryRow includes group action menu labels for Expand/Collapse entire group', () => {
    const onExpandEntire = vi.fn()
    const onCollapseEntire = vi.fn()
    const onRename = vi.fn()
    const onDelete = vi.fn()

    act(() => {
      root.render(
        <CategoryRow
          node={{ key: 'cat1', label: 'Category 1', expanded: true, containsCurrent: false, workspaces: [] }}
          t={t}
          onExpandEntire={onExpandEntire}
          onCollapseEntire={onCollapseEntire}
          onRename={onRename}
          onDelete={onDelete}
        />,
      )
    })

    const menuItems = Array.from(host.querySelectorAll('button'))
    const expandItem = menuItems.find(b => b.textContent === 'group.expandEntire')
    const collapseItem = menuItems.find(b => b.textContent === 'group.collapseEntire')

    expect(expandItem).toBeDefined()
    expect(collapseItem).toBeDefined()

    act(() => {
      expandItem?.click()
    })
    expect(onExpandEntire).toHaveBeenCalledTimes(1)

    act(() => {
      collapseItem?.click()
    })
    expect(onCollapseEntire).toHaveBeenCalledTimes(1)
  })

  it('GroupsBrowser handles header menu presence/absence and fixed control/scroller layout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ categories: [{ name: 'Dev', rules: [{ pathPrefix: '/w1' }] }] }),
      headers: new Headers(),
    }))

    const useSessions = vi.fn((selector) => selector({
      ids: ['s1'],
      byId: { s1: { id: 's1', displayTitle: 'S1', blank: false, running: false, updatedAt: Date.now() } },
      current: undefined,
    }))
    const useWorkspaces = vi.fn((selector) => selector({
      items: [{ workspaceId: 'w1', path: '/w1', title: 'W1', createdAt: '2026-01-01', sessionIds: ['s1'] }],
      phase: 'ready',
      archivedSessionIds: [],
    }))
    const useStore = vi.fn((selector) => selector({ categoryExpansion: {}, workspaceExpansion: {} }))
    const setCategoryExpanded = vi.fn()
    const setWorkspaceExpanded = vi.fn()
    const setCategoriesExpanded = vi.fn()
    const setWorkspacesExpanded = vi.fn()

    await act(async () => {
      root.render(
        <GroupsBrowser
          wide={true}
          expandSidebar={() => {}}
          useSessions={useSessions as never}
          useSessionPendingInteraction={((selector: (value: Map<never, never>) => unknown) => selector(emptyPending)) as never}
          useWorkspaces={useWorkspaces as never}
          useStore={useStore as never}
          actions={{ setCategoryExpanded, setWorkspaceExpanded, setCategoriesExpanded, setWorkspacesExpanded, retainKeys: () => {} } as never}
          startSession={async () => {}}
          open={() => {}}
          renameSession={async () => {}}
          forkSession={async () => {}}
          renameWorkspace={async () => {}}
          deleteWorkspace={async () => {}}
          insertWorkspaceBefore={async () => {}}
          archiveSession={async () => {}}
          cleanupSessions={async () => {}}
          insertSessionBefore={async () => {}}
          createWorkspace={async () => ({} as never)}
          listDirectory={async () => ({} as never)}
          createDirectory={async () => ''}
          searchSessions={async () => ({ items: [], hasMore: false })}
          searchResultLimit={20}
          t={((key: string) => key) as never}
        />,
      )
    })

    // Fixed control/scroller structure
    const treeBody = host.querySelector('.wgTreeBody')
    expect(treeBody).not.toBeNull()
    const treeControls = host.querySelector('.wgTreeBody > .wgTreeControls')
    expect(treeControls).not.toBeNull()
    expect(treeControls?.querySelector('.wgFilterBar')).not.toBeNull()
    const treeScroller = host.querySelector('.wgTreeBody > .wgTreeScroller')
    expect(treeScroller).not.toBeNull()
    expect(treeScroller?.querySelector('.wgList')).not.toBeNull()

    // Header Menu and direct Collapse All button presence when normalizedQuery === ''
    const headerCollapseAllBtn = host.querySelector<HTMLElement>('[aria-label="tree.collapseAll"]')
    expect(headerCollapseAllBtn).not.toBeNull()

    const treeActionsBtn = host.querySelector<HTMLElement>('[aria-label="tree.actions"]')
    expect(treeActionsBtn).not.toBeNull()

    // Test direct Collapse All header button in idle mode
    await act(async () => {
      headerCollapseAllBtn?.click()
    })
    expect(setCategoriesExpanded).toHaveBeenCalledWith(['Dev'], false)
    expect(setWorkspacesExpanded).toHaveBeenCalledWith(['w1'], false)
    setCategoriesExpanded.mockClear()
    setWorkspacesExpanded.mockClear()

    // Test global commands in idle mode via menu
    const menuContainer = treeActionsBtn?.closest('[data-menu-portal]')
    const collapseAllBtn = Array.from(menuContainer?.querySelectorAll('button') ?? []).find(b => b.textContent === 'tree.collapseAll')
    const expandGroupsBtn = Array.from(menuContainer?.querySelectorAll('button') ?? []).find(b => b.textContent === 'tree.expandGroups')
    const expandAllBtn = Array.from(menuContainer?.querySelectorAll('button') ?? []).find(b => b.textContent === 'tree.expandAll')

    expect(collapseAllBtn).toBeDefined()
    expect(expandGroupsBtn).toBeDefined()
    expect(expandAllBtn).toBeDefined()

    await act(async () => {
      collapseAllBtn?.click()
    })
    expect(setCategoriesExpanded).toHaveBeenCalledWith(['Dev'], false)
    expect(setWorkspacesExpanded).toHaveBeenCalledWith(['w1'], false)

    await act(async () => {
      expandGroupsBtn?.click()
    })
    expect(setCategoriesExpanded).toHaveBeenCalledWith(['Dev'], true)
    expect(setWorkspacesExpanded).toHaveBeenCalledWith(['w1'], false)

    await act(async () => {
      expandAllBtn?.click()
    })
    expect(setCategoriesExpanded).toHaveBeenCalledWith(['Dev'], true)
    expect(setWorkspacesExpanded).toHaveBeenCalledWith(['w1'], true)

    setCategoriesExpanded.mockClear()
    setWorkspacesExpanded.mockClear()
    const expandGroupBtn = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'group.expandEntire')
    await act(async () => { expandGroupBtn?.click() })
    expect(setCategoriesExpanded).toHaveBeenCalledWith(['Dev'], true)
    expect(setWorkspacesExpanded).toHaveBeenCalledWith(['w1'], true)

    vi.unstubAllGlobals()
  })

  it('GroupsBrowser restores and persists filters while keeping filtered expansion transient', async () => {
    const filterWrites: unknown[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/workspace-groups/preferences')) {
        if (init?.method === 'PUT') {
          const body = JSON.parse(String(init.body)) as { filter: unknown }
          filterWrites.push(body.filter)
          return { ok: true, status: 200, json: async () => ({ filter: body.filter }), headers: new Headers() }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ filter: { status: 'warning', recency: '7d', color: 'blue' } }),
          headers: new Headers(),
        }
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          categories: [{ name: 'Dev', rules: [{ pathPrefix: '/w1' }] }],
          manual: { categories: ['Empty'], assignments: {}, colors: { Dev: 'blue' }, groupIcons: { Dev: 'book' }, workspaceIcons: { w1: 'deepseek' } },
        }),
        headers: new Headers(),
      }
    }))

    const sessionsSnapshot = {
      ids: ['s1'],
      byId: { s1: { id: 's1', displayTitle: 'S1', blank: false, running: true, updatedAt: Date.now() } },
      current: undefined,
    }
    const workspacesSnapshot = {
      items: [{ workspaceId: 'w1', path: '/w1', title: 'W1', createdAt: '2026-01-01', sessionIds: ['s1'] }],
      phase: 'ready',
      archivedSessionIds: [],
    }
    const viewSnapshot = { categoryExpansion: {}, workspaceExpansion: {} }
    const useSessions = vi.fn((selector) => selector(sessionsSnapshot))
    const useWorkspaces = vi.fn((selector) => selector(workspacesSnapshot))
    const useStore = vi.fn((selector) => selector(viewSnapshot))
    const setCategoryExpanded = vi.fn()
    const setWorkspaceExpanded = vi.fn()
    const setCategoriesExpanded = vi.fn()
    const setWorkspacesExpanded = vi.fn()

    const renderBrowser = () => root.render(
        <GroupsBrowser
          wide={true}
          expandSidebar={() => {}}
          useSessions={useSessions as never}
          useSessionPendingInteraction={((selector: (value: Map<never, never>) => unknown) => selector(emptyPending)) as never}
          useWorkspaces={useWorkspaces as never}
          useStore={useStore as never}
          actions={{ setCategoryExpanded, setWorkspaceExpanded, setCategoriesExpanded, setWorkspacesExpanded, retainKeys: () => {} } as never}
          startSession={async () => {}}
          open={() => {}}
          renameSession={async () => {}}
          forkSession={async () => {}}
          renameWorkspace={async () => {}}
          deleteWorkspace={async () => {}}
          insertWorkspaceBefore={async () => {}}
          archiveSession={async () => {}}
          cleanupSessions={async () => {}}
          insertSessionBefore={async () => {}}
          createWorkspace={async () => ({} as never)}
          listDirectory={async () => ({} as never)}
          createDirectory={async () => ''}
          searchSessions={async () => ({ items: [], hasMore: false })}
          searchResultLimit={20}
          t={((key: string) => key) as never}
        />,
      )
    await act(async () => { renderBrowser() })

    runtimeMocks.indexSubagentDescendants.mockClear()
    const scopes = Array.from(host.querySelectorAll('.wgStatusScopeBtn'))
    expect(scopes[1]?.getAttribute('aria-pressed')).toBe('true')
    // Change the restored filter without rebuilding the canonical session tree.
    await act(async () => {
      scopes[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    expect(filterWrites[0]).toEqual({ status: 'ongoing', recency: '7d', color: 'blue', workspaceId: '', groupKey: '' })
    expect(runtimeMocks.indexSubagentDescendants).not.toHaveBeenCalled()

    setCategoriesExpanded.mockClear()
    setWorkspacesExpanded.mockClear()
    setCategoryExpanded.mockClear()
    setWorkspaceExpanded.mockClear()

    // Global command in filter mode -> transient filter write, no persisted batch call
    const treeActionsBtn = host.querySelector<HTMLElement>('[aria-label="tree.actions"]')!
    const menuContainer = treeActionsBtn.closest('[data-menu-portal]')
    const expandAllBtn = Array.from(menuContainer?.querySelectorAll('button') ?? []).find(b => b.textContent === 'tree.expandAll')

    await act(async () => {
      expandAllBtn?.click()
    })

    expect(host.querySelector('.wgCategoryRow')?.getAttribute('aria-expanded')).toBe('true')
    expect(host.querySelector('.wgProjectRow')?.getAttribute('aria-expanded')).toBe('true')
    expect(setCategoriesExpanded).not.toHaveBeenCalled()
    expect(setWorkspacesExpanded).not.toHaveBeenCalled()
    expect(setCategoryExpanded).not.toHaveBeenCalled()
    expect(setWorkspaceExpanded).not.toHaveBeenCalled()

    // Open search input -> tree actions menu and collapse all button should be absent when query is non-empty
    const searchInputBtn = host.querySelector<HTMLElement>('.wgSearch .wgIconButton')!
    await act(async () => {
      searchInputBtn.click()
    })
    const searchInput = host.querySelector<HTMLInputElement>('.wgSearchInput')!
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      nativeSetter?.call(searchInput, 'hello')
      searchInput.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(host.querySelector('[aria-label="tree.actions"]')).toBeNull()
    expect(host.querySelector('[aria-label="tree.collapseAll"]')).toBeNull()

    await act(async () => {
      host.querySelector<HTMLButtonElement>('.wgFilterResetBtn')?.click()
      await Promise.resolve()
    })
    expect(filterWrites[1]).toEqual({ status: 'all', recency: 'all', color: null, workspaceId: '', groupKey: '' })
    const projectSelect = host.querySelector<HTMLButtonElement>('[aria-label^="filter.project:"]')!
    await act(async () => { projectSelect.click() })
    const workspaceOption = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'W1')!
    expect(workspaceOption.textContent).not.toContain('/w1')
    expect(workspaceOption.querySelector('[data-wg-folder-icon="deepseek"]')).not.toBeNull()
    await act(async () => { workspaceOption.click() })
    expect(filterWrites.at(-1)).toEqual({ status: 'all', recency: 'all', color: null, workspaceId: 'w1', groupKey: '' })
    expect(host.querySelector('[aria-label^="filter.project:"]')?.textContent).toBe('W1')
    const chooseGroup = async (label: string) => {
      await act(async () => { host.querySelector<HTMLButtonElement>('[aria-label^="filter.group:"]')!.click() })
      const option = Array.from(host.querySelectorAll('button')).find(button => button.textContent === label)!
      if (label === 'Dev') expect(option.querySelector('[data-wg-folder-icon="book"]')).not.toBeNull()
      await act(async () => { option.click() })
    }
    await chooseGroup('Dev')
    expect(filterWrites.at(-1)).toEqual({ status: 'all', recency: 'all', color: null, workspaceId: 'w1', groupKey: 'Dev' })
    expect(host.querySelector('[aria-label^="filter.group:"] [data-wg-folder-icon="book"]')).not.toBeNull()
    await chooseGroup('Empty')
    expect(filterWrites.at(-1)).toEqual({ status: 'all', recency: 'all', color: null, workspaceId: '', groupKey: 'Empty' })
    await act(async () => { host.querySelector<HTMLButtonElement>('[aria-label^="filter.project:"]')!.click() })
    expect(Array.from(host.querySelectorAll('button')).some(button => button.textContent === 'W1')).toBe(false)
    await act(async () => { host.querySelector<HTMLButtonElement>('[aria-label^="filter.project:"]')!.click() })
    await chooseGroup('section.topLevel')
    expect(filterWrites.at(-1)).toMatchObject({ groupKey: '__topLevel__' })
    await chooseGroup('filter.group.all')
    expect(filterWrites.at(-1)).toMatchObject({ groupKey: '' })
    await act(async () => { projectSelect.click() })
    await act(async () => { Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'W1')!.click() })
    await act(async () => { workspacesSnapshot.phase = 'loading'; workspacesSnapshot.items = []; renderBrowser() })
    expect(filterWrites.at(-1)).toHaveProperty('workspaceId', 'w1')
    await act(async () => { workspacesSnapshot.phase = 'ready'; renderBrowser() })
    expect(filterWrites.at(-1)).toHaveProperty('workspaceId', '')

    vi.unstubAllGlobals()
  })

  it('opens cleanup dialog from tree actions and archives eligible sessions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ categories: [] }),
      headers: new Headers(),
    }))

    const archiveSession = vi.fn().mockResolvedValue(undefined)
    const now = Date.now()
    const dayMs = 86_400_000

    const useSessions = vi.fn((selector) => selector({
      ids: ['s1', 's2', 's3'],
      byId: {
        s1: { id: 's1', displayTitle: 'Old Session 1', blank: false, running: false, updatedAt: now - 40 * dayMs },
        s2: { id: 's2', displayTitle: 'New Session 2', blank: false, running: false, updatedAt: now - 5 * dayMs },
        s3: { id: 's3', displayTitle: 'Old Running 3', blank: false, running: true, updatedAt: now - 50 * dayMs },
      },
      current: undefined,
    }))

    const useWorkspaces = vi.fn((selector) => selector({
      items: [{ workspaceId: 'w1', path: '/w1', title: 'W1', createdAt: '2026-01-01', sessionIds: ['s1', 's2', 's3'] }],
      phase: 'ready',
      archivedSessionIds: [],
    }))

    const useStore = vi.fn((selector) => selector({ categoryExpansion: {}, workspaceExpansion: { w1: true } }))

    await act(async () => {
      root.render(
        <GroupsBrowser
          wide={true}
          expandSidebar={() => {}}
          useSessions={useSessions as never}
          useSessionPendingInteraction={((selector: (value: Map<never, never>) => unknown) => selector(emptyPending)) as never}
          useWorkspaces={useWorkspaces as never}
          useStore={useStore as never}
          actions={{ setCategoryExpanded: () => {}, setWorkspaceExpanded: () => {}, retainKeys: () => {} } as never}
          startSession={async () => {}}
          open={() => {}}
          renameSession={async () => {}}
          forkSession={async () => {}}
          renameWorkspace={async () => {}}
          deleteWorkspace={async () => {}}
          insertWorkspaceBefore={async () => {}}
          archiveSession={archiveSession}
          cleanupSessions={async (ids) => { for (const id of ids) await archiveSession(id) }}
          insertSessionBefore={async () => {}}
          createWorkspace={async () => ({} as never)}
          listDirectory={async () => ({} as never)}
          createDirectory={async () => ''}
          searchSessions={async () => ({ items: [], hasMore: false })}
          searchResultLimit={20}
          t={((key: string) => key) as never}
        />,
      )
    })

    // Open Tree Actions menu
    const treeActionsBtn = host.querySelector<HTMLElement>('[aria-label="tree.actions"]')!
    const menuContainer = treeActionsBtn.closest('[data-menu-portal]')
    const cleanupBtn = Array.from(menuContainer?.querySelectorAll('button') ?? []).find(b => b.textContent === 'cleanup.action')
    expect(cleanupBtn).toBeDefined()

    await act(async () => {
      cleanupBtn?.click()
    })

    // Dialog should be open
    const dialogTitle = host.querySelector('.wgCleanupDescription')
    expect(dialogTitle).not.toBeNull()
    expect(dialogTitle?.textContent).toBe('cleanup.description')

    // At default 30 days, only s1 (40 days) should match; s2 is 5 days, s3 is running
    const preview = host.querySelector('.wgCleanupCount')
    expect(preview?.textContent).toContain('1')

    // Switch to 7 days preset
    const preset7 = Array.from(host.querySelectorAll('.wgCleanupPresetBtn')).find(b => b.textContent?.startsWith('7'))
    expect(preset7).toBeDefined()

    await act(async () => {
      preset7?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Now both s1 (40 days) and s2 (5 days) are not > 7 days, wait: 40 days > 7 days, but 5 days is NOT > 7 days!
    // So still 1!
    // What if we enter 2 days in custom input?
    const numberInput = host.querySelector<HTMLInputElement>('.wgCleanupNumberInput')!
    expect(numberInput).not.toBeNull()

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      nativeSetter?.call(numberInput, '2')
      numberInput.dispatchEvent(new Event('input', { bubbles: true }))
      numberInput.dispatchEvent(new Event('change', { bubbles: true }))
    })

    // Now at 2 days cutoff: s1 (40 days) and s2 (5 days) are older than 2 days! Count is 2.
    const preview2 = host.querySelector('.wgCleanupCount')
    expect(preview2?.textContent).toContain('2')

    // Confirm archiving
    const confirmBtn = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'cleanup.confirm')
    expect(confirmBtn).toBeDefined()

    await act(async () => {
      confirmBtn?.click()
    })

    // archiveSession should have been called for s1 and s2 (sorted oldest first: s1 then s2)
    expect(archiveSession).toHaveBeenCalledTimes(2)
    expect(archiveSession).toHaveBeenNthCalledWith(1, 's1')
    expect(archiveSession).toHaveBeenNthCalledWith(2, 's2')

    vi.unstubAllGlobals()
  })

  it('opens cleanup dialog from workspace menu scoped to that workspace', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ categories: [] }),
      headers: new Headers(),
    }))

    const archiveSession = vi.fn().mockResolvedValue(undefined)
    const now = Date.now()
    const dayMs = 86_400_000

    const useSessions = vi.fn((selector) => selector({
      ids: ['s1', 's2'],
      byId: {
        s1: { id: 's1', displayTitle: 'Old Session in W1', blank: false, running: false, updatedAt: now - 40 * dayMs },
        s2: { id: 's2', displayTitle: 'Old Session in W2', blank: false, running: false, updatedAt: now - 40 * dayMs },
      },
      current: undefined,
    }))

    const useWorkspaces = vi.fn((selector) => selector({
      items: [
        { workspaceId: 'w1', path: '/w1', title: 'W1', createdAt: '2026-01-01', sessionIds: ['s1'] },
        { workspaceId: 'w2', path: '/w2', title: 'W2', createdAt: '2026-01-01', sessionIds: ['s2'] },
      ],
      phase: 'ready',
      archivedSessionIds: [],
    }))

    const useStore = vi.fn((selector) => selector({ categoryExpansion: {}, workspaceExpansion: { w1: true, w2: true } }))

    await act(async () => {
      root.render(
        <GroupsBrowser
          wide={true}
          expandSidebar={() => {}}
          useSessions={useSessions as never}
          useSessionPendingInteraction={((selector: (value: Map<never, never>) => unknown) => selector(emptyPending)) as never}
          useWorkspaces={useWorkspaces as never}
          useStore={useStore as never}
          actions={{ setCategoryExpanded: () => {}, setWorkspaceExpanded: () => {}, retainKeys: () => {} } as never}
          startSession={async () => {}}
          open={() => {}}
          renameSession={async () => {}}
          forkSession={async () => {}}
          renameWorkspace={async () => {}}
          deleteWorkspace={async () => {}}
          insertWorkspaceBefore={async () => {}}
          archiveSession={archiveSession}
          cleanupSessions={async (ids) => { for (const id of ids) await archiveSession(id) }}
          insertSessionBefore={async () => {}}
          createWorkspace={async () => ({} as never)}
          listDirectory={async () => ({} as never)}
          createDirectory={async () => ''}
          searchSessions={async () => ({ items: [], hasMore: false })}
          searchResultLimit={20}
          t={((key: string) => key) as never}
        />,
      )
    })

    // Find the WorkspaceRow for w1
    const w1Row = host.querySelector('[data-wsid="w1"]')
    expect(w1Row).not.toBeNull()

    // Find cleanup button in w1's menu items
    const cleanupBtn = Array.from(w1Row?.querySelectorAll('button') ?? []).find(b => b.textContent === 'cleanup.action')
    expect(cleanupBtn).toBeDefined()

    await act(async () => {
      cleanupBtn?.click()
    })

    // Scope should show w1's label
    const scopeEl = host.querySelector('.wgCleanupScope')
    expect(scopeEl?.textContent).toContain('W1')

    // Count should be 1 (only s1 from w1, even though s2 is also >30 days old)
    const preview = host.querySelector('.wgCleanupCount')
    expect(preview?.textContent).toContain('1')

    // Confirm
    const confirmBtn = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'cleanup.confirm')
    await act(async () => {
      confirmBtn?.click()
    })

    expect(archiveSession).toHaveBeenCalledOnce()
    expect(archiveSession).toHaveBeenCalledWith('s1')

    vi.unstubAllGlobals()
  })

  it('CategoryRow renders quick add button and action menu item for group.addWorkspace', () => {
    const onAddWorkspace = vi.fn()
    const onRename = vi.fn()
    const onDelete = vi.fn()

    act(() => {
      root.render(
        <CategoryRow
          node={{ key: 'cat1', label: 'Category 1', expanded: true, containsCurrent: false, workspaces: [] }}
          t={t}
          onAddWorkspace={onAddWorkspace}
          onRename={onRename}
          onDelete={onDelete}
        />,
      )
    })

    const quickAddBtn = host.querySelector<HTMLButtonElement>('button[title="group.addWorkspace"]')
    expect(quickAddBtn).not.toBeNull()
    expect(quickAddBtn?.getAttribute('aria-label')).toBe('group.addWorkspace: Category 1')

    act(() => {
      quickAddBtn?.click()
    })
    expect(onAddWorkspace).toHaveBeenCalledTimes(1)

    const menuItems = Array.from(host.querySelectorAll('button'))
    const addItem = menuItems.find(b => b.textContent === 'group.addWorkspace')
    expect(addItem).toBeDefined()

    act(() => {
      addItem?.click()
    })
    expect(onAddWorkspace).toHaveBeenCalledTimes(2)
  })

  it('GroupsBrowser supports adding workspace directly inside a specific group with overlay persistence', async () => {
    let capturedManualBody: { expectedRevision: string; manual: any } | null = null
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/workspace-groups/config')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ etag: 'rev-1' }),
          json: () => Promise.resolve({
            categories: [{ key: 'Dev', label: 'Dev', rules: [] }],
            manual: { categories: ['Dev'], assignments: {}, workspaceOrder: {} },
          }),
        })
      }
      if (url.includes('/workspace-groups/manual') && init?.method === 'PUT') {
        capturedManualBody = JSON.parse(init.body as string)
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ etag: 'rev-2' }),
          json: () => Promise.resolve({ ok: true, revision: 'rev-2' }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve({}) })
    })
    vi.stubGlobal('fetch', fetchMock)

    const sessionsSnapshot = { ids: [], byId: {}, current: undefined }
    const workspacesSnapshot = {
      items: [],
      phase: 'ready',
      archivedSessionIds: [],
    }
    const viewSnapshot = { categoryExpansion: { Dev: true }, workspaceExpansion: {} }
    const useSessions = vi.fn((selector) => selector(sessionsSnapshot))
    const useWorkspaces = vi.fn((selector) => selector(workspacesSnapshot))
    const useStore = vi.fn((selector) => selector(viewSnapshot))
    const setCategoryExpanded = vi.fn()
    const startSession = vi.fn()
    const createWorkspace = vi.fn().mockResolvedValue({
      workspaceId: 'ws-new',
      path: '/home/user',
      title: 'user',
      createdAt: '2026-01-01',
      sessionIds: [],
    })

    await act(async () => {
      root.render(
        <GroupsBrowser
          wide={true}
          expandSidebar={() => {}}
          useSessions={useSessions as never}
          useSessionPendingInteraction={((selector: (value: Map<never, never>) => unknown) => selector(emptyPending)) as never}
          useWorkspaces={useWorkspaces as never}
          useStore={useStore as never}
          actions={{ setCategoryExpanded, setWorkspaceExpanded: () => {}, retainKeys: () => {} } as never}
          startSession={startSession}
          open={() => {}}
          renameSession={async () => {}}
          forkSession={async () => {}}
          renameWorkspace={async () => {}}
          deleteWorkspace={async () => {}}
          insertWorkspaceBefore={async () => {}}
          archiveSession={async () => {}}
          cleanupSessions={async () => {}}
          insertSessionBefore={async () => {}}
          createWorkspace={createWorkspace}
          listDirectory={async () => ({ path: '/home/user', entries: [], crumbs: [] } as never)}
          createDirectory={async () => ''}
          searchSessions={async () => ({ items: [], hasMore: false })}
          searchResultLimit={20}
          t={((key: string) => key) as never}
        />,
      )
    })

    const devCategoryRow = host.querySelector('[data-wg-category="Dev"]')
    expect(devCategoryRow).not.toBeNull()

    const addBtn = devCategoryRow?.querySelector<HTMLButtonElement>('button[title="group.addWorkspace"]')
    expect(addBtn).not.toBeNull()

    await act(async () => {
      addBtn?.click()
    })

    // DirectoryBrowser should be open and its title should include Dev
    const modalTitle = host.querySelector('.wgModalTitle')
    expect(modalTitle?.textContent).toContain('directory.title — Dev')

    // Find the DirectoryBrowser Select/Open button (with text directory.open)
    const openBtn = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'directory.open')
    expect(openBtn).toBeDefined()

    await act(async () => {
      openBtn?.click()
    })

    expect(createWorkspace).toHaveBeenCalledWith({ path: '/home/user' })
    expect(capturedManualBody).not.toBeNull()
    expect((capturedManualBody as any).manual.assignments['ws-new']).toBe('Dev')
    expect((capturedManualBody as any).manual.workspaceOrder['Dev']).toContain('ws-new')
    expect(startSession).toHaveBeenCalledWith('ws-new')
    expect(setCategoryExpanded).toHaveBeenCalledWith('Dev', true)

    vi.unstubAllGlobals()
  })

  it('canceling DirectoryBrowser resets targetCategoryForAdd without modifying manual overlay', async () => {
    let capturedManualPut = false
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/workspace-groups/config')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ etag: 'rev-1' }),
          json: () => Promise.resolve({
            categories: [{ key: 'Dev', label: 'Dev', rules: [] }],
            manual: { categories: ['Dev'], assignments: {}, workspaceOrder: {} },
          }),
        })
      }
      if (url.includes('/workspace-groups/manual') && init?.method === 'PUT') {
        capturedManualPut = true
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ etag: 'rev-2' }),
          json: () => Promise.resolve({ ok: true, revision: 'rev-2' }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, headers: new Headers(), json: () => Promise.resolve({}) })
    })
    vi.stubGlobal('fetch', fetchMock)

    const sessionsSnapshot = { ids: [], byId: {}, current: undefined }
    const workspacesSnapshot = {
      items: [],
      phase: 'ready',
      archivedSessionIds: [],
    }
    const viewSnapshot = { categoryExpansion: { Dev: true }, workspaceExpansion: {} }
    const useSessions = vi.fn((selector) => selector(sessionsSnapshot))
    const useWorkspaces = vi.fn((selector) => selector(workspacesSnapshot))
    const useStore = vi.fn((selector) => selector(viewSnapshot))
    const createWorkspace = vi.fn()

    await act(async () => {
      root.render(
        <GroupsBrowser
          wide={true}
          expandSidebar={() => {}}
          useSessions={useSessions as never}
          useSessionPendingInteraction={((selector: (value: Map<never, never>) => unknown) => selector(emptyPending)) as never}
          useWorkspaces={useWorkspaces as never}
          useStore={useStore as never}
          actions={{ setCategoryExpanded: () => {}, setWorkspaceExpanded: () => {}, retainKeys: () => {} } as never}
          startSession={async () => {}}
          open={() => {}}
          renameSession={async () => {}}
          forkSession={async () => {}}
          renameWorkspace={async () => {}}
          deleteWorkspace={async () => {}}
          insertWorkspaceBefore={async () => {}}
          archiveSession={async () => {}}
          cleanupSessions={async () => {}}
          insertSessionBefore={async () => {}}
          createWorkspace={createWorkspace}
          listDirectory={async () => ({ path: '/home/user', entries: [], crumbs: [] } as never)}
          createDirectory={async () => ''}
          searchSessions={async () => ({ items: [], hasMore: false })}
          searchResultLimit={20}
          t={((key: string) => key) as never}
        />,
      )
    })

    const devCategoryRow = host.querySelector('[data-wg-category="Dev"]')
    const addBtn = devCategoryRow?.querySelector<HTMLButtonElement>('button[title="group.addWorkspace"]')

    await act(async () => {
      addBtn?.click()
    })

    expect(host.querySelector('.wgModalTitle')?.textContent).toContain('directory.title — Dev')

    // Click cancel button
    const cancelBtn = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'directory.cancel')
    expect(cancelBtn).toBeDefined()

    await act(async () => {
      cancelBtn?.click()
    })

    expect(createWorkspace).not.toHaveBeenCalled()
    expect(capturedManualPut).toBe(false)
    expect(host.querySelector('.wgModalTitle')).toBeNull()

    vi.unstubAllGlobals()
  })
})
