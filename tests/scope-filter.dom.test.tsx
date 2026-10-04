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
  return { Menu, IconFolderClose16: icon, IconChevronDownOutline14: icon, IconClockOutline16: icon }
})
import { ScopeFilter } from '../src/client/ScopeFilter.tsx'
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
  it('changes only period and dismisses with Escape', () => {
    const change = vi.fn()
    act(() => { root.render(<SidebarFilterControls filter={filter} onChange={change} t={t} />) })
    const trigger = host.querySelector<HTMLButtonElement>('[data-wg-filter-period-trigger]')!
    act(() => { trigger.click() })
    const choices = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    expect(choices).toHaveLength(4)
    expect(choices[2]?.querySelector('svg text')?.textContent).toBe('7')
    act(() => { choices[3]!.click() })
    expect(change).toHaveBeenCalledWith({ ...filter, recency: '30d' })
    act(() => { trigger.click() })
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
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
