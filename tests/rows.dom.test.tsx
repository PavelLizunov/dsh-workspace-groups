/** @vitest-environment jsdom */
import React from 'react'
import { act } from 'react'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeMocks = vi.hoisted(() => ({
  indexSubagentDescendants: vi.fn(() => new Map()),
}))
vi.mock('@deepseek-ai/dsh-client-runtime/client', () => runtimeMocks)

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
  Modal: ({ children, open }: { children?: React.ReactNode; open?: boolean }) => (open ? <div>{children}</div> : null),
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  IconArchiveOutline20: () => <span />,
  IconBranchOutline16: () => <span />,
  IconCloseFill14: () => <span />,
  IconEditOutline16: () => <span />,
  IconEllipsisOutline16: () => <span />,
  IconFolderClose16: () => <span />,
  IconFolderOpen16: () => <span />,
  IconFolderOpenOutline16: () => <span />,
  IconPlusOutline16: () => <span />,
  IconProjectAddOutline16: () => <span />,
  IconRefreshOutline14: () => <span />,
  IconSearchOutline16: () => <span />,
  IconTriangleRightFill14: () => <span />,
  IconTrashOutline16: () => <span />,
  StateDot: ({ state }: { state?: string }) => <span data-state-dot={state ?? ''} />,
  Menu: ({ anchor, items, onSelect, portal, compact }: { anchor: React.ReactNode; items: Array<{ id: string; label: React.ReactNode; disabled?: boolean; submenu?: Array<{ id: string; label: React.ReactNode; disabled?: boolean }> }>; onSelect: (id: string) => void; portal?: boolean; compact?: boolean }) => (
    <div data-menu-portal={portal || undefined} data-menu-compact={compact || undefined} data-has-submenu={items.some(item => (item.submenu?.length ?? 0) > 0) || undefined}>
      {anchor}
      {items.flatMap(item => [item, ...(item.submenu ?? [])]).map(item => (
        <button key={item.id} disabled={item.disabled} onClick={() => onSelect(item.id)}>{item.label}</button>
      ))}
    </div>
  ),
}))

import { CategoryRow, DND_WORKSPACE_TYPE, SessionRow, WorkspaceRow, sessionDotState } from '../src/client/rows.tsx'
import { GroupsBrowser } from '../src/client/GroupsBrowser.tsx'

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
})

describe('row interaction contracts', () => {
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
    const colorDot = host.querySelector('.wgColorDot')
    expect(colorDot?.getAttribute('data-color')).toBe('blue')

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
    expect(host.querySelector('.wgColorDot')?.getAttribute('data-color')).toBe('blue')
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
          insertSessionBefore={async () => {}}
          createWorkspace={async () => ({} as never)}
          listDirectory={async () => ({} as never)}
          createDirectory={async () => ''}
          searchSessions={async () => ({ items: [], hasMore: false })}
          searchResultLimit={20}
          useHostDescription={(() => ({})) as never}
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
    const filterTrigger = host.querySelector('[aria-label="filter.title"]')
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

    // Reset filter
    await act(async () => {
      resetBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(scopes[0]?.getAttribute('aria-pressed')).toBe('true')
    expect(host.querySelector('.wgFilterSummary')).toBeNull()

    vi.unstubAllGlobals()
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
          insertSessionBefore={async () => {}}
          createWorkspace={async () => ({} as never)}
          listDirectory={async () => ({} as never)}
          createDirectory={async () => ''}
          searchSessions={async () => ({ items: [], hasMore: false })}
          searchResultLimit={20}
          useHostDescription={(() => ({})) as never}
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

    // Header Menu presence when normalizedQuery === ''
    const treeActionsBtn = host.querySelector<HTMLElement>('[aria-label="tree.actions"]')
    expect(treeActionsBtn).not.toBeNull()

    // Test global commands in idle mode
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
          manual: { categories: [], assignments: {}, colors: { Dev: 'blue' } },
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

    await act(async () => {
      root.render(
        <GroupsBrowser
          wide={true}
          expandSidebar={() => {}}
          useSessions={useSessions as never}
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
          insertSessionBefore={async () => {}}
          createWorkspace={async () => ({} as never)}
          listDirectory={async () => ({} as never)}
          createDirectory={async () => ''}
          searchSessions={async () => ({ items: [], hasMore: false })}
          searchResultLimit={20}
          useHostDescription={(() => ({})) as never}
          t={((key: string) => key) as never}
        />,
      )
    })

    runtimeMocks.indexSubagentDescendants.mockClear()
    const scopes = Array.from(host.querySelectorAll('.wgStatusScopeBtn'))
    expect(scopes[1]?.getAttribute('aria-pressed')).toBe('true')
    // Change the restored filter without rebuilding the canonical session tree.
    await act(async () => {
      scopes[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    expect(filterWrites[0]).toEqual({ status: 'ongoing', recency: '7d', color: 'blue' })
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

    // Open search input -> tree actions menu should be absent when query is non-empty
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

    await act(async () => {
      host.querySelector<HTMLButtonElement>('.wgFilterResetBtn')?.click()
      await Promise.resolve()
    })
    expect(filterWrites[1]).toEqual({ status: 'all', recency: 'all', color: null })

    vi.unstubAllGlobals()
  })
})
