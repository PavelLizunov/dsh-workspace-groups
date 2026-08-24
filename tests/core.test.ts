/**
 * Pure-logic tests: classification rules (the matcher v2: display names,
 * ordering, force-uncategorized) and config parsing.
 * These are the plugin's business rules — no DOM, no cordis runtime.
 */
import { describe, expect, it } from 'vitest'
import {
  displayCategoryKeys,
  effectiveCategories,
  isManualOnlyCategory,
  moveAfter,
  moveBefore,
  orderedWorkspaceIds,
  originalRuleNameForDisplay,
  resolveCategory,
  ruleDisplayName,
  takenCategoryNames,
} from '../src/core/matcher.ts'
import { parseGroupsConfig } from '../src/host-config.ts'
import {
  normalizePath,
  TOP_LEVEL_ORDER_KEY,
  UNCATEGORIZED_LABEL,
  type GroupsConfig,
  type ManualGroups,
} from '../src/core/types.ts'

const CONFIG: GroupsConfig = {
  categories: [
    {
      name: 'DSH Plugins',
      rules: [
        { pathPrefix: '/Users/zcol/Project/SkillsManagePlugins' },
        { nameContains: 'Peak' },
      ],
    },
    {
      name: 'Docs',
      rules: [{ basenameContains: 'docs' }],
    },
  ],
}

describe('classify', () => {
  it('matches by path prefix', () => {
    expect(resolveCategory(CONFIG, undefined, 'ws', '/Users/zcol/Project/SkillsManagePlugins', 'SkillsManagePlugins')).toBe('DSH Plugins')
  })

  it('matches by name substring', () => {
    expect(resolveCategory(CONFIG, undefined, 'ws', '/Users/zcol/Project/DeepSeekPeakWidget', 'DeepSeekPeakWidget')).toBe('DSH Plugins')
  })

  it('matches by basename substring', () => {
    expect(resolveCategory(CONFIG, undefined, 'ws', '/Users/zcol/Project/SomeDocs', 'SomeDocs')).toBe('Docs')
  })

  it('first match wins across categories', () => {
    const config: GroupsConfig = {
      categories: [
        { name: 'A', rules: [{ nameContains: 'common' }] },
        { name: 'B', rules: [{ nameContains: 'common' }] },
      ],
    }
    expect(resolveCategory(config, undefined, 'ws', '/p/x', 'common-project')).toBe('A')
  })

  it('returns undefined when nothing matches', () => {
    expect(resolveCategory(CONFIG, undefined, 'ws', '/tmp/random', 'Random')).toBeUndefined()
  })

  it('normalizes POSIX and Windows separators for pathPrefix and pathExact', () => {
    const config: GroupsConfig = {
      categories: [
        { name: 'WinPrefix', rules: [{ pathPrefix: 'C:/Users/zcol/Project' }] },
        { name: 'WinExact', rules: [{ pathExact: 'D:\\Data\\Repo' }] },
      ],
    }
    expect(resolveCategory(config, undefined, 'ws-1', 'C:\\Users\\zcol\\Project\\SubApp', 'SubApp')).toBe('WinPrefix')
    expect(resolveCategory(config, undefined, 'ws-2', 'D:/Data/Repo', 'Repo')).toBe('WinExact')
    expect(resolveCategory(config, undefined, 'ws-3', 'D:/Data/Repo/', 'Repo')).toBe('WinExact')
  })

  it('preserves POSIX and Windows drive roots during path normalization', () => {
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('///')).toBe('/')
    expect(normalizePath('C:/')).toBe('C:/')
    expect(normalizePath('C:\\')).toBe('C:/')
    expect(normalizePath('C:\\\\')).toBe('C:/')
    const config: GroupsConfig = {
      categories: [
        { name: 'PosixRoot', rules: [{ pathExact: '/' }] },
        { name: 'WinRoot', rules: [{ pathExact: 'C:/' }] },
      ],
    }
    expect(resolveCategory(config, undefined, 'ws-1', '/', 'root')).toBe('PosixRoot')
    expect(resolveCategory(config, undefined, 'ws-2', 'C:\\', 'drive')).toBe('WinRoot')
  })

  it('respects pathPrefix segment boundaries', () => {
    const config: GroupsConfig = {
      categories: [
        { name: 'Project', rules: [{ pathPrefix: '/Users/zcol/Project' }] },
      ],
    }
    expect(resolveCategory(config, undefined, 'ws-1', '/Users/zcol/Project', 'Project')).toBe('Project')
    expect(resolveCategory(config, undefined, 'ws-2', '/Users/zcol/Project/SubApp', 'SubApp')).toBe('Project')
    expect(resolveCategory(config, undefined, 'ws-3', '/Users/zcol/Project-Other', 'Project-Other')).toBeUndefined()
    expect(resolveCategory(config, undefined, 'ws-4', '/Users/zcol/Projects', 'Projects')).toBeUndefined()
  })
})

describe('resolveCategory (v2 overlay semantics)', () => {
  it('a manual override wins over rules', () => {
    const manual: ManualGroups = { categories: ['Temporary'], assignments: { 'ws-manual': 'Temporary' } }
    expect(resolveCategory(CONFIG, manual, 'ws-manual', '/Users/zcol/Project/SomeDocs', 'SomeDocs')).toBe('Temporary')
  })

  it('a null override forces the uncategorized bucket even when a rule matches', () => {
    const manual: ManualGroups = { categories: [], assignments: { 'ws-null': null } }
    expect(resolveCategory(CONFIG, manual, 'ws-null', '/Users/zcol/Project/SkillsManagePlugins', 'SkillsManagePlugins')).toBeUndefined()
  })

  it('falls back to rules without an override', () => {
    const manual: ManualGroups = { categories: ['Temporary'], assignments: { 'ws-other': 'Temporary' } }
    expect(resolveCategory(CONFIG, manual, 'ws-x', '/Users/zcol/Project/SkillsManagePlugins', 'SkillsManagePlugins')).toBe('DSH Plugins')
  })

  it('a renamed rule category resolves to its display name', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, renamed: { 'DSH Plugins': 'Plugin Collection' } }
    expect(ruleDisplayName(manual, 'DSH Plugins')).toBe('Plugin Collection')
    expect(resolveCategory(CONFIG, manual, 'ws-x', '/Users/zcol/Project/SkillsManagePlugins', 'SkillsManagePlugins')).toBe('Plugin Collection')
    expect(originalRuleNameForDisplay(CONFIG.categories, manual, 'Plugin Collection')).toBe('DSH Plugins')
  })

  it('a hidden rule category is inert — matches fall to uncategorized', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, hidden: ['DSH Plugins'] }
    expect(resolveCategory(CONFIG, manual, 'ws-x', '/Users/zcol/Project/SkillsManagePlugins', 'SkillsManagePlugins')).toBeUndefined()
  })

  it('falls through a hidden first matching rule to a later active matching category', () => {
    const config: GroupsConfig = {
      categories: [
        { name: 'Primary', rules: [{ pathPrefix: '/Users/zcol/Project' }] },
        { name: 'Fallback', rules: [{ nameContains: 'Demo' }] },
      ],
    }
    const manual: ManualGroups = { categories: [], assignments: {}, hidden: ['Primary'] }
    expect(resolveCategory(config, manual, 'ws-1', '/Users/zcol/Project/Demo', 'Demo')).toBe('Fallback')
  })

  it('resolves top-level when assignment targets a hidden, missing, or legacy uncategorized category', () => {
    const manual: ManualGroups = {
      categories: ['Temporary'],
      assignments: {
        'ws-hidden': 'DSH Plugins',
        'ws-missing': 'NonExistentGroup',
        'ws-legacy': UNCATEGORIZED_LABEL,
      },
      hidden: ['DSH Plugins'],
    }
    expect(resolveCategory(CONFIG, manual, 'ws-hidden', '/tmp/a', 'A')).toBeUndefined()
    expect(resolveCategory(CONFIG, manual, 'ws-missing', '/tmp/b', 'B')).toBeUndefined()
    expect(resolveCategory(CONFIG, manual, 'ws-legacy', '/tmp/c', 'C')).toBeUndefined()
  })
})

describe('displayCategoryKeys / effectiveCategories', () => {
  it('rule categories first, manual ones appended', () => {
    const manual: ManualGroups = { categories: ['Temporary', 'Archive'], assignments: {} }
    expect(displayCategoryKeys(CONFIG, manual)).toEqual(['DSH Plugins', 'Docs', 'Temporary', 'Archive'])
  })

  it('categoryOrder overrides the sequence; unknown entries keep default order', () => {
    const manual: ManualGroups = {
      categories: ['Temporary'],
      assignments: {},
      categoryOrder: ['Temporary', 'Docs', 'DSH Plugins'],
    }
    expect(displayCategoryKeys(CONFIG, manual)).toEqual(['Temporary', 'Docs', 'DSH Plugins'])
  })

  it('hidden rules drop out; renamed rules appear under the new name', () => {
    const manual: ManualGroups = {
      categories: [],
      assignments: {},
      hidden: ['Docs'],
      renamed: { 'DSH Plugins': 'Plugin Collection' },
    }
    const keys = displayCategoryKeys(CONFIG, manual)
    expect(keys).toEqual(['Plugin Collection'])
    expect(effectiveCategories(CONFIG, manual)[0]).toEqual({ key: 'Plugin Collection', source: 'rule' })
  })

  it('uncategorized is never part of the key list', () => {
    expect(displayCategoryKeys(CONFIG, undefined).includes(UNCATEGORIZED_LABEL)).toBe(false)
  })
})

describe('isManualOnlyCategory', () => {
  const manual: ManualGroups = { categories: ['Temporary'], assignments: {} }

  it('true for a manual-only category', () => {
    expect(isManualOnlyCategory(CONFIG, manual, 'Temporary')).toBe(true)
  })

  it('false for a rule category', () => {
    expect(isManualOnlyCategory(CONFIG, manual, 'DSH Plugins')).toBe(false)
  })

  it('false for an unknown name', () => {
    expect(isManualOnlyCategory(CONFIG, manual, 'NonExistent')).toBe(false)
  })

  it('false when the overlay is absent', () => {
    expect(isManualOnlyCategory(CONFIG, undefined, 'Temporary')).toBe(false)
  })
})

describe('takenCategoryNames', () => {
  it('covers rule display names, manual groups and the reserved label', () => {
    const manual: ManualGroups = {
      categories: ['Temporary'],
      assignments: {},
      renamed: { 'DSH Plugins': 'Plugin Collection' },
    }
    const taken = takenCategoryNames(CONFIG, manual)
    expect(taken.has('Plugin Collection')).toBe(true)
    expect(taken.has('Docs')).toBe(true)
    expect(taken.has('Temporary')).toBe(true)
    expect(taken.has(UNCATEGORIZED_LABEL)).toBe(true)
    expect(taken.has('New Group')).toBe(false)
  })

  it('reserves TOP_LEVEL_ORDER_KEY alongside the legacy uncategorized label', () => {
    const taken = takenCategoryNames(CONFIG, undefined)
    expect(taken.has(TOP_LEVEL_ORDER_KEY)).toBe(true)
    expect(taken.has(UNCATEGORIZED_LABEL)).toBe(true)
  })
})

describe('orderedWorkspaceIds / moveBefore / moveAfter', () => {
  it('stored order wins, missing members appended in fallback order', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, workspaceOrder: { 'DSH Plugins': ['b', 'a'] } }
    expect(orderedWorkspaceIds(manual, 'DSH Plugins', ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
  })

  it('falls back to host order without a stored order', () => {
    expect(orderedWorkspaceIds(undefined, 'DSH Plugins', ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('moveBefore moves an id before a target (or appends)', () => {
    expect(moveBefore(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(moveBefore(['a', 'b', 'c'], 'a', undefined)).toEqual(['b', 'c', 'a'])
    expect(moveBefore(['a', 'b', 'c'], 'c', 'zzz')).toEqual(['a', 'b', 'c'])
  })

  it('preserves list order on moveBefore self-drop', () => {
    expect(moveBefore(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c'])
    expect(moveBefore(['a', 'b', 'c'], 'a', 'a')).toEqual(['a', 'b', 'c'])
    expect(moveBefore(['a', 'b', 'c'], 'c', 'c')).toEqual(['a', 'b', 'c'])
  })

  it('moveAfter moves an id after a target (or appends)', () => {
    expect(moveAfter(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
    expect(moveAfter(['a', 'b', 'c'], 'c', undefined)).toEqual(['a', 'b', 'c'])
    expect(moveAfter(['a', 'b', 'c'], 'a', 'zzz')).toEqual(['b', 'c', 'a'])
  })

  it('preserves list order on moveAfter self-drop', () => {
    expect(moveAfter(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c'])
    expect(moveAfter(['a', 'b', 'c'], 'a', 'a')).toEqual(['a', 'b', 'c'])
    expect(moveAfter(['a', 'b', 'c'], 'c', 'c')).toEqual(['a', 'b', 'c'])
  })
})

describe('parseGroupsConfig', () => {
  it('parses a valid document', () => {
    const parsed = parseGroupsConfig({
      categories: [
        { name: 'X', rules: [{ pathPrefix: '/a' }] },
      ],
    })
    expect(parsed.categories).toHaveLength(1)
    expect(parsed.categories[0]?.name).toBe('X')
  })

  it('empty document yields empty categories', () => {
    expect(parseGroupsConfig(undefined).categories).toEqual([])
    expect(parseGroupsConfig({}).categories).toEqual([])
  })

  it('rejects a category without a name', () => {
    expect(() => parseGroupsConfig({ categories: [{ rules: [] }] })).toThrow(/name/)
  })

  it('rejects a rule with no matchers', () => {
    expect(() => parseGroupsConfig({ categories: [{ name: 'X', rules: [{}] }] })).toThrow(/no matchers/)
  })

  it('rejects a non-list categories value', () => {
    expect(() => parseGroupsConfig({ categories: 'nope' })).toThrow(/list/)
  })

  it('trims category names', () => {
    const parsed = parseGroupsConfig({ categories: [{ name: '  X  ', rules: [{ pathPrefix: '/a' }] }] })
    expect(parsed.categories[0]?.name).toBe('X')
  })

  it('rejects the reserved uncategorized label as a category name', () => {
    expect(() => parseGroupsConfig({ categories: [{ name: UNCATEGORIZED_LABEL, rules: [{ pathPrefix: '/a' }] }] })).toThrow(/reserved/)
  })

  it('rejects the reserved top-level order key as a category name', () => {
    expect(() => parseGroupsConfig({ categories: [{ name: TOP_LEVEL_ORDER_KEY, rules: [{ pathPrefix: '/a' }] }] })).toThrow(/reserved/)
  })
})
