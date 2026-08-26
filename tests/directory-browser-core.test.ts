import { describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({}))

import {
  filterDirectoryEntries,
  formatCrumbs,
  isImeComposing,
  resolveNewFolderTarget,
} from '../src/client/DirectoryBrowser.tsx'
import type { DirectoryEntry } from '@deepseek-ai/dsh-client-runtime/client'

describe('filterDirectoryEntries', () => {
  const sampleEntries: DirectoryEntry[] = [
    { name: 'src', path: '/app/src', hidden: false },
    { name: '.git', path: '/app/.git', hidden: true },
    { name: '.env', path: '/app/.env', hidden: false },
    { name: 'node_modules', path: '/app/node_modules', hidden: false },
    { name: 'hidden_folder', path: '/app/hidden_folder', hidden: true },
  ]

  it('filters out hidden and dot-prefixed entries when showHidden is false', () => {
    const result = filterDirectoryEntries(sampleEntries, false)
    expect(result).toEqual([
      { name: 'src', path: '/app/src', hidden: false },
      { name: 'node_modules', path: '/app/node_modules', hidden: false },
    ])
  })

  it('returns all entries when showHidden is true', () => {
    const result = filterDirectoryEntries(sampleEntries, true)
    expect(result).toEqual(sampleEntries)
  })

  it('handles empty entries array', () => {
    expect(filterDirectoryEntries([], false)).toEqual([])
    expect(filterDirectoryEntries([], true)).toEqual([])
  })
})

describe('formatCrumbs', () => {
  it('formats root crumb as Home when no homePath is provided', () => {
    const crumbs: DirectoryEntry[] = [
      { name: '', path: '/', hidden: false },
      { name: 'usr', path: '/usr', hidden: false },
    ]
    const formatted = formatCrumbs(crumbs, undefined, 'Home')
    expect(formatted).toEqual([
      { path: '/', name: 'Home', isHome: false },
      { path: '/usr', name: 'usr', isHome: false },
    ])
  })

  it('identifies exact homePath in crumbs and marks isHome true', () => {
    const crumbs: DirectoryEntry[] = [
      { name: '', path: '/', hidden: false },
      { name: 'home', path: '/home', hidden: false },
      { name: 'user', path: '/home/user', hidden: false },
      { name: 'projects', path: '/home/user/projects', hidden: false },
    ]
    const formatted = formatCrumbs(crumbs, '/home/user', 'Home')
    expect(formatted).toEqual([
      { path: '/', name: '/', isHome: false },
      { path: '/home', name: 'home', isHome: false },
      { path: '/home/user', name: 'Home', isHome: true },
      { path: '/home/user/projects', name: 'projects', isHome: false },
    ])
  })

  it('uses default slash name for root crumb when viewing outside home', () => {
    const crumbs: DirectoryEntry[] = [
      { name: '', path: '/', hidden: false },
      { name: 'var', path: '/var', hidden: false },
      { name: 'log', path: '/var/log', hidden: false },
    ]
    const formatted = formatCrumbs(crumbs, '/home/user', 'Home')
    expect(formatted).toEqual([
      { path: '/', name: '/', isHome: false },
      { path: '/var', name: 'var', isHome: false },
      { path: '/var/log', name: 'log', isHome: false },
    ])
  })

  it('handles empty crumbs list', () => {
    expect(formatCrumbs([], '/home/user', 'Home')).toEqual([])
  })
})

describe('resolveNewFolderTarget', () => {
  it('returns selectedPath if selectedPath is present', () => {
    expect(resolveNewFolderTarget('/app/src', '/app')).toBe('/app/src')
  })

  it('falls back to listingPath when selectedPath is undefined', () => {
    expect(resolveNewFolderTarget(undefined, '/app')).toBe('/app')
  })

  it('returns undefined when both are undefined', () => {
    expect(resolveNewFolderTarget(undefined, undefined)).toBeUndefined()
  })
})

describe('isImeComposing', () => {
  it('detects nativeEvent.isComposing', () => {
    const event = { nativeEvent: { isComposing: true } } as unknown as React.KeyboardEvent
    expect(isImeComposing(event)).toBe(true)
  })

  it('detects top-level isComposing', () => {
    const event = { isComposing: true } as unknown as React.KeyboardEvent
    expect(isImeComposing(event)).toBe(true)
  })

  it('returns false when not composing', () => {
    const event = { nativeEvent: { isComposing: false } } as unknown as React.KeyboardEvent
    expect(isImeComposing(event)).toBe(false)
  })
})
