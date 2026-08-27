/**
 * Manual-overlay tests: shape validation, cross-validation against rule
 * categories, and the atomic file round-trip (temp dir, no host needed).
 */
import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  parseManualGroups,
  readManualGroups,
  validateManualGroups,
  writeManualGroups,
} from '../src/host-manual.ts'
import { TOP_LEVEL_ORDER_KEY, UNCATEGORIZED_LABEL, type ManualGroups } from '../src/core/types.ts'

const RULE_NAMES = ['DSH Plugins', 'Personal Projects']

describe('parseManualGroups', () => {
  it('parses a valid overlay', () => {
    const parsed = parseManualGroups({
      categories: ['Temporary'],
      assignments: { 'ws-1': 'Temporary', 'ws-2': 'DSH Plugins' },
    })
    expect(parsed).toEqual({
      categories: ['Temporary'],
      assignments: { 'ws-1': 'Temporary', 'ws-2': 'DSH Plugins' },
    })
  })

  it('empty / undefined input yields an empty overlay', () => {
    expect(parseManualGroups(undefined)).toEqual({ categories: [], assignments: {} })
    expect(parseManualGroups({})).toEqual({ categories: [], assignments: {} })
  })

  it('rejects a non-mapping top level', () => {
    expect(() => parseManualGroups([])).toThrow(/mapping/)
    expect(() => parseManualGroups('nope')).toThrow(/mapping/)
  })

  it('rejects non-string / empty category names and trims them', () => {
    expect(() => parseManualGroups({ categories: [42] })).toThrow(/non-empty string/)
    expect(() => parseManualGroups({ categories: [''] })).toThrow(/non-empty string/)
    expect(parseManualGroups({ categories: [' Temporary '] }).categories).toEqual(['Temporary'])
  })

  it('rejects the reserved uncategorized label as a manual category', () => {
    expect(() => parseManualGroups({ categories: [UNCATEGORIZED_LABEL] })).toThrow(/reserved/)
  })

  it('rejects the reserved top-level key as a manual category', () => {
    expect(() => parseManualGroups({ categories: [TOP_LEVEL_ORDER_KEY] })).toThrow(/reserved/)
  })

  it('rejects duplicate category names', () => {
    expect(() => parseManualGroups({ categories: ['Temporary', 'Temporary'] })).toThrow(/duplicate/)
  })

  it('rejects a non-mapping assignments value', () => {
    expect(() => parseManualGroups({ assignments: [] })).toThrow(/assignments/)
  })

  it('rejects empty assignment keys and non-string assignment values', () => {
    expect(() => parseManualGroups({ assignments: { '': 'Temporary' } })).toThrow(/non-empty/)
    expect(() => parseManualGroups({ assignments: { 'ws-1': 42 } })).toThrow(/category name/)
  })

  it('accepts null assignment values (force uncategorized)', () => {
    const parsed = parseManualGroups({ assignments: { 'ws-1': null } })
    expect(parsed.assignments['ws-1']).toBeNull()
  })

  it('parses the v2 ordering/rename/hidden fields', () => {
    const parsed = parseManualGroups({
      categories: ['Temporary'],
      assignments: { 'ws-1': 'Temporary' },
      categoryOrder: ['Temporary', 'DSH Plugins'],
      workspaceOrder: { 'Temporary': ['ws-1'] },
      renamed: { 'DSH Plugins': 'Plugin Collection' },
      hidden: ['Docs'],
    })
    expect(parsed.categoryOrder).toEqual(['Temporary', 'DSH Plugins'])
    expect(parsed.workspaceOrder).toEqual({ 'Temporary': ['ws-1'] })
    expect(parsed.renamed).toEqual({ 'DSH Plugins': 'Plugin Collection' })
    expect(parsed.hidden).toEqual(['Docs'])
  })

  it('rejects duplicate categoryOrder / hidden entries', () => {
    expect(() => parseManualGroups({ categoryOrder: ['A', 'A'] })).toThrow(/duplicate/)
    expect(() => parseManualGroups({ hidden: ['A', 'A'] })).toThrow(/duplicate/)
  })

  it('rejects non-string renamed values', () => {
    expect(() => parseManualGroups({ renamed: { 'DSH Plugins': 42 } })).toThrow(/non-empty string/)
  })

  it('rejects the reserved top-level key as a renamed display value', () => {
    expect(() => parseManualGroups({ renamed: { 'DSH Plugins': TOP_LEVEL_ORDER_KEY } })).toThrow(/reserved/)
  })
})

describe('validateManualGroups v2 (write boundary)', () => {
  it('accepts null assignments and renamed-display targets', () => {
    const manual: ManualGroups = {
      categories: ['Temporary'],
      assignments: { 'ws-1': null, 'ws-2': 'Plugin Collection' },
      renamed: { 'DSH Plugins': 'Plugin Collection' },
    }
    expect(() => validateManualGroups(manual, RULE_NAMES)).not.toThrow()
  })

  it('rejects renamed keys that are not rule categories', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, renamed: { 'GhostRule': 'X' } }
    expect(() => validateManualGroups(manual, RULE_NAMES)).toThrow(/renamed/)
  })

  it('rejects hidden entries that are not rule categories', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, hidden: ['GhostRule'] }
    expect(() => validateManualGroups(manual, RULE_NAMES)).toThrow(/hidden/)
  })

  it('rejects categoryOrder / workspaceOrder keys that exist nowhere', () => {
    const manual1: ManualGroups = { categories: [], assignments: {}, categoryOrder: ['Ghost'] }
    expect(() => validateManualGroups(manual1, RULE_NAMES)).toThrow(/categoryOrder/)
    const manual2: ManualGroups = { categories: [], assignments: {}, workspaceOrder: { 'Ghost': [] } }
    expect(() => validateManualGroups(manual2, RULE_NAMES)).toThrow(/workspaceOrder/)
  })

  it('rejects the reserved top-level order key in categoryOrder', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, categoryOrder: [TOP_LEVEL_ORDER_KEY] }
    expect(() => validateManualGroups(manual, RULE_NAMES)).toThrow(/categoryOrder/)
  })

  it('accepts the reserved top-level order key in workspaceOrder', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, workspaceOrder: { [TOP_LEVEL_ORDER_KEY]: ['ws-1', 'ws-2'] } }
    expect(() => validateManualGroups(manual, RULE_NAMES)).not.toThrow()
  })
})

describe('validateManualGroups (write boundary)', () => {
  it('accepts assignments into rule, manual, and uncategorized categories', () => {
    const manual: ManualGroups = {
      categories: ['Temporary'],
      assignments: { 'ws-1': 'Temporary', 'ws-2': 'DSH Plugins', 'ws-3': UNCATEGORIZED_LABEL },
    }
    expect(() => validateManualGroups(manual, RULE_NAMES)).not.toThrow()
  })

  it('rejects an assignment into a category that exists nowhere', () => {
    const manual: ManualGroups = { categories: [], assignments: { 'ws-1': 'GhostGroup' } }
    expect(() => validateManualGroups(manual, RULE_NAMES)).toThrow(/unknown category/)
  })

  it('rejects the reserved top-level order key as an assignment category', () => {
    const manual: ManualGroups = { categories: [], assignments: { 'ws-1': TOP_LEVEL_ORDER_KEY } }
    expect(() => validateManualGroups(manual, RULE_NAMES)).toThrow(/unknown category/)
  })
})

describe('manual file round-trip', () => {
  it('a missing file yields an empty overlay', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wg-manual-'))
    try {
      expect(await readManualGroups(join(dir, 'missing.json'))).toEqual({ categories: [], assignments: {} })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('write then read returns the same overlay with colors', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wg-manual-'))
    const path = join(dir, 'workspace-groups.manual.json')
    try {
      const overlay: ManualGroups = {
        categories: ['Temporary'],
        assignments: { 'ws-1': 'Temporary' },
        colors: { 'Temporary': 'red', 'ws-1': 'blue' },
      }
      await writeManualGroups(path, overlay)
      expect(await readManualGroups(path)).toEqual(overlay)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
