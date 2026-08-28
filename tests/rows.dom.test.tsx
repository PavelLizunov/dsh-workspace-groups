/** @vitest-environment jsdom */
import React from 'react'
import { act } from 'react'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  IconArchiveOutline20: () => <span />,
  IconBranchOutline16: () => <span />,
  IconEditOutline16: () => <span />,
  IconEllipsisOutline16: () => <span />,
  IconFolderClose16: () => <span />,
  IconFolderOpen16: () => <span />,
  IconFolderOpenOutline16: () => <span />,
  IconPlusOutline16: () => <span />,
  IconProjectAddOutline16: () => <span />,
  IconTriangleRightFill14: () => <span />,
  IconTrashOutline16: () => <span />,
  StateDot: () => <span data-state-dot />,
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
})
