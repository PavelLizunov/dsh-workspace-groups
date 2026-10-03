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
  return { Menu, IconFolderClose16: icon, IconChevronDownOutline14: icon }
})
import { ScopeFilter } from '../src/client/ScopeFilter.tsx'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// This file intentionally uses the real published Menu, not the row-suite mock.
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
