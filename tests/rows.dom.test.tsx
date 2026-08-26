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
  Menu: ({ anchor, items, onSelect }: { anchor: React.ReactNode; items: Array<{ id: string; label: React.ReactNode; disabled?: boolean }>; onSelect: (id: string) => void }) => (
    <div>{anchor}{items.map(item => <button key={item.id} disabled={item.disabled} onClick={() => onSelect(item.id)}>{item.label}</button>)}</div>
  ),
}))

import { CategoryRow, SessionRow, WorkspaceRow } from '../src/client/rows.tsx'

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
})
