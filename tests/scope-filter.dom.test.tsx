/** @vitest-environment jsdom */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// The published primitives package omits its runtime dependency graph. Execute its
// exact bundled Menu region with React; stub only styling and decorative host icons.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const fs = await import('node:fs')
  const { createRequire } = await import('node:module')
  const react = await import('react')
  const dom = await import('react-dom')
  const runtime = await import('react/jsx-runtime')
  const source = fs.readFileSync(createRequire(import.meta.url).resolve('@deepseek-ai/dsh-client-ui-primitives'), 'utf8')
  const start = source.indexOf('function usePointerGrace(')
  const end = source.indexOf('//#region lib/types/useAnchoredMaxHeight.js')
  if (start < 0 || end <= start) throw new Error('Published Menu bundle boundaries changed; review test extraction')
  const menuSource = source.slice(start, end)
  const icon = () => react.createElement('svg')
  const Menu = new Function('React', 'createPortal', 'clsx', 'css$7', 'IconCheckOutline16', 'jsx', 'jsxs',
    `const {useRef,useState,useEffect,useLayoutEffect,useCallback}=React; ${menuSource}; return Menu;`
  )(react, dom.createPortal, (...classes: unknown[]) => classes.filter(Boolean).join(' '), {}, icon, runtime.jsx, runtime.jsxs)
  const Modal = ({ open, children, footer }: { open: boolean; children: React.ReactNode; footer: React.ReactNode }) => open ? react.createElement('div', { role: 'dialog' }, children, footer) : null
  const Button = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => react.createElement('button', props, children)
  return { Menu, Modal, Button, IconFolderClose16: icon, IconChevronDownOutline14: icon, IconClockOutline16: icon, IconChevronLeftOutline14: icon, IconChevronRightOutline14: icon }
})
import { ScopeFilter } from '../src/client/ScopeFilter.tsx'
import { WorkspaceNavigator } from '../src/client/WorkspaceNavigator.tsx'
import { SidebarFilterControls } from '../src/client/SidebarFilterControls.tsx'
import type { SidebarFilter } from '../src/client/tree-filter.ts'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// This file intentionally uses the real published Menu, not the row-suite mock.
describe('visual color and period controls', () => {
  let host: HTMLDivElement
  let root: Root
  beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
  afterEach(() => { act(() => root.unmount()); host.remove() })
  const filter: SidebarFilter = { status: 'warning', color: 'blue', recency: '7d', groupKey: 'DSH', workspaceId: 'w1' }
  const t = ((key: string) => key) as never
  it('shows selections and all nine labelled palette choices', () => {
    const change = vi.fn()
    act(() => { root.render(<SidebarFilterControls filter={filter} onChange={change} t={t} />) })
    const color = host.querySelector<HTMLButtonElement>('[data-wg-filter-color]')!
    expect(color.textContent).toContain('color.blue')
    expect(host.querySelector('[data-wg-filter-period-trigger]')?.textContent).toContain('filter.recency.7d')
    act(() => { color.click() })
    const choices = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    expect(choices).toHaveLength(9)
    expect(choices[6]?.querySelector('[data-wg-filter-selected="true"]')).not.toBeNull()
    act(() => { choices[1]!.click() })
    expect(change).toHaveBeenCalledWith({ ...filter, color: 'red' })
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })
  it('clears only color, preserving period and scopes', () => {
    const change = vi.fn()
    act(() => { root.render(<SidebarFilterControls filter={filter} onChange={change} t={t} />) })
    act(() => { host.querySelector<HTMLButtonElement>('[data-wg-filter-color]')!.click() })
    act(() => { document.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click() })
    expect(change).toHaveBeenCalledWith({ ...filter, color: null })
  })
  it('applies validated calendar range only on Apply; Cancel preserves it', () => {
    const change = vi.fn()
    act(() => { root.render(<SidebarFilterControls filter={filter} onChange={change} t={t} />) })
    const trigger = host.querySelector<HTMLButtonElement>('[data-wg-filter-period-trigger]')!
    act(() => { trigger.click() })
    act(() => { document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[7]!.click() })
    const dialog = host.querySelector('[role="dialog"]')!
    const inputs = dialog.querySelectorAll<HTMLInputElement>('input[type="date"]')
    const input = (i: number, value: string) => { act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(inputs[i],value);inputs[i]!.dispatchEvent(new Event('input',{bubbles:true})) }) }
    input(0,'2026-10-05');input(1,'2026-10-04')
    const apply = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(x=>x.textContent==='filter.range.apply')!
    expect(apply.disabled).toBe(true)
    input(0,'2026-10-01')
    expect(apply.disabled).toBe(false)
    act(() => { apply.click() })
    expect(change).toHaveBeenCalledWith({...filter,recency:'custom',dateRange:{from:new Date(2026,9,1).getTime(),to:new Date(2026,9,5).getTime()}})
    act(() => { trigger.click() });act(() => { document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')[7]!.click() })
    const cancel = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(x=>x.textContent==='filter.range.cancel')!
    act(() => { cancel.click() });expect(change).toHaveBeenCalledTimes(1)
  })
  it('changes only period and dismisses with Escape', () => {
    const change = vi.fn()
    act(() => { root.render(<SidebarFilterControls filter={filter} onChange={change} t={t} />) })
    const trigger = host.querySelector<HTMLButtonElement>('[data-wg-filter-period-trigger]')!
    act(() => { trigger.click() })
    const choices = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    expect(choices).toHaveLength(8)
    expect(choices[4]?.querySelector('svg text')?.textContent).toBe('7')
    act(() => { choices[5]!.click() })
    expect(change).toHaveBeenCalledWith({ ...filter, recency: '30d' })
    act(() => { trigger.click() })
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('workspace navigator', () => {
  let host: HTMLDivElement
  let root: Root
  const groups = [{ id: 'Dev', label: 'Development', icon: 'code' }, { id: 'Empty', label: 'Empty' }]
  const workspaces = [{ id: 'w1', label: 'Alpha', groupKey: 'Dev', icon: 'deepseek' }, { id: 'w2', label: 'Beta', groupKey: 'Dev' }]
  const t = ((key: string) => key) as never
  beforeEach(() => { host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
  afterEach(() => { act(() => root.unmount()); host.remove() })
  function render(onScope = vi.fn(), onNavigate = vi.fn(async () => {})) {
    act(() => { root.render(<WorkspaceNavigator groups={groups} workspaces={workspaces} groupKey="" workspaceId="" onScope={onScope} onNavigate={onNavigate} t={t} />) })
    act(() => { host.querySelector<HTMLButtonElement>('[data-wg-workspace-navigator]')!.click() })
    return { onScope, onNavigate }
  }
  function type(value: string) { act(() => {
    const input = document.querySelector<HTMLInputElement>('.wgNavigatorSearch')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }) }
  it('drills and goes back without changing scopes or navigating', () => {
    const { onScope, onNavigate } = render()
    act(() => { document.querySelector<HTMLButtonElement>('[data-wg-picker-group="Dev"]')!.click() })
    expect(document.querySelectorAll('[data-wg-picker-workspace]')).toHaveLength(2)
    expect(onScope).not.toHaveBeenCalled(); expect(onNavigate).not.toHaveBeenCalled()
    act(() => { document.querySelector<HTMLButtonElement>('[data-wg-picker-back]')!.click() })
    expect(document.querySelector('[data-wg-picker-group="Dev"]')).not.toBeNull()
  })
  it('searches workspaces across groups and navigates once', async () => {
    const { onNavigate } = render()
    type('alpha')
    expect(document.querySelectorAll('[data-wg-picker-workspace]')).toHaveLength(1)
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-wg-picker-workspace="w1"]')!.click() })
    expect(onNavigate).toHaveBeenCalledWith(workspaces[0])
    expect(document.querySelector('.wgNavigatorPopup')).toBeNull()
  })
  it('scopes an empty group explicitly, with no native open', () => {
    const { onScope, onNavigate } = render()
    act(() => { document.querySelector<HTMLButtonElement>('[data-wg-picker-group="Empty"]')!.click() })
    expect(document.querySelector('.wgNavigatorEmpty')?.textContent).toBe('navigator.empty')
    act(() => { document.querySelector<HTMLButtonElement>('[data-wg-picker-scope]')!.click() })
    expect(onScope).toHaveBeenCalledWith('Empty', '');expect(onNavigate).not.toHaveBeenCalled()
  })
  it('keeps failed navigation visible and allows retry', async () => {
    const onNavigate = vi.fn(async () => { throw Error('Host refused') })
    render(vi.fn(), onNavigate);type('Alpha')
    await act(async () => { document.querySelector<HTMLButtonElement>('[data-wg-picker-workspace="w1"]')!.click() })
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('Host refused')
    expect(document.querySelector<HTMLButtonElement>('[data-wg-picker-workspace="w1"]')?.disabled).toBe(false)
  })
  it('prevents duplicate opens while pending', async () => {
    let finish!: () => void
    const onNavigate = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    render(vi.fn(), onNavigate);type('Alpha')
    const row = document.querySelector<HTMLButtonElement>('[data-wg-picker-workspace="w1"]')!
    act(() => { row.click(); row.click() })
    expect(onNavigate).toHaveBeenCalledTimes(1)
    expect(row.disabled).toBe(true)
    await act(async () => { finish() })
    expect(document.querySelector('.wgNavigatorPopup')).toBeNull()
  })
  it('supports search-to-list keyboard navigation, back and Escape focus', () => {
    render()
    const input = document.querySelector<HTMLInputElement>('.wgNavigatorSearch')!
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    expect(document.activeElement).toBe(document.querySelector('[data-wg-picker-scope]'))
    act(() => { document.querySelector<HTMLButtonElement>('[data-wg-picker-group="Dev"]')!.click() })
    const row = document.querySelector<HTMLButtonElement>('[data-wg-picker-workspace="w1"]')!
    act(() => { row.focus();row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })) })
    expect(document.querySelector('[data-wg-picker-group="Dev"]')).not.toBeNull()
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(document.activeElement).toBe(host.querySelector('[data-wg-workspace-navigator]'))
    expect(document.querySelector('.wgNavigatorPopup')).toBeNull()
  })
})

describe('scope filter with the host Menu', () => {
  let host: HTMLDivElement
  let root: Root
  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })
  afterEach(() => { act(() => root.unmount()); host.remove() })

  it('renders names/icons and chooses a value by keyboard in its portal', () => {
    const change = vi.fn()
    act(() => root.render(<ScopeFilter label="Workspace" value="" onChange={change} options={[
      { id: '', label: 'All workspaces' },
      { id: 'w1', label: 'Research', icon: 'book', color: 'blue' },
      { id: 'w2', label: 'Voice', icon: 'microphone' },
    ]} />))
    const trigger = host.querySelector<HTMLButtonElement>('button')!
    expect(trigger.getAttribute('aria-label')).toBe('Workspace: All workspaces')
    act(() => { trigger.click() })
    const menu = document.body.querySelector<HTMLElement>('[role="menu"]')!
    expect(menu).not.toBeNull()
    expect(host.contains(menu)).toBe(false)
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(3)
    expect(menu.querySelector('[data-wg-folder-icon="book"]')).not.toBeNull()
    expect(menu.textContent).toContain('Research')
    expect(menu.textContent).not.toContain('/workspaces/')
    act(() => { menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })) })
    expect(document.activeElement?.textContent).toBe('Research')
    // jsdom does not synthesize the native button click for Enter/Space.
    act(() => { (document.activeElement as HTMLButtonElement).click() })
    expect(change).toHaveBeenCalledWith('w1')
    expect(document.body.querySelector('[role="menu"]')).toBeNull()
  })

  it('closes on Escape without changing selection and supports the All value', () => {
    const change = vi.fn()
    act(() => root.render(<ScopeFilter label="Group" value="Dev" onChange={change} options={[
      { id: '', label: 'All groups' }, { id: 'Dev', label: 'Dev', icon: 'book' },
    ]} />))
    const trigger = host.querySelector<HTMLButtonElement>('button')!
    expect(trigger.querySelector('[data-wg-folder-icon="book"]')).not.toBeNull()
    act(() => { trigger.click() })
    act(() => { document.body.querySelector('[role="menu"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(change).not.toHaveBeenCalled()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    act(() => { trigger.click() })
    act(() => { document.body.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click() })
    expect(change).toHaveBeenCalledWith('')
  })
})
