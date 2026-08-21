/**
 * Pure-logic tests: classification rules (the matcher) and config parsing.
 * These are the plugin's business rules — no DOM, no cordis runtime.
 */
import { describe, expect, it } from 'vitest'
import { classify } from '../src/core/matcher.ts'
import { parseGroupsConfig } from '../src/host-config.ts'
import type { GroupsConfig } from '../src/core/types.ts'

const CONFIG: GroupsConfig = {
  categories: [
    {
      name: 'DSH 插件',
      rules: [
        { pathPrefix: '/Users/zcol/Project/SkillsManagePlugins' },
        { nameContains: '峰谷' },
      ],
    },
    {
      name: '文档',
      rules: [{ basenameContains: 'docs' }],
    },
  ],
}

describe('classify', () => {
  it('matches by path prefix', () => {
    const category = classify(CONFIG.categories, '/Users/zcol/Project/SkillsManagePlugins', 'SkillsManagePlugins')
    expect(category?.name).toBe('DSH 插件')
  })

  it('matches by name substring', () => {
    const category = classify(CONFIG.categories, '/Users/zcol/Project/DeepSeek峰谷小组件', 'DeepSeek峰谷小组件')
    expect(category?.name).toBe('DSH 插件')
  })

  it('matches by basename substring', () => {
    const category = classify(CONFIG.categories, '/Users/zcol/Project/SomeDocs', 'SomeDocs')
    expect(category?.name).toBe('文档')
  })

  it('first match wins across categories', () => {
    const config: GroupsConfig = {
      categories: [
        { name: 'A', rules: [{ nameContains: 'common' }] },
        { name: 'B', rules: [{ nameContains: 'common' }] },
      ],
    }
    const category = classify(config.categories, '/p/x', 'common-project')
    expect(category?.name).toBe('A')
  })

  it('returns undefined when nothing matches', () => {
    const category = classify(CONFIG.categories, '/tmp/random', 'Random')
    expect(category).toBeUndefined()
  })

  it('path prefix matching strips trailing slashes', () => {
    const category = classify(CONFIG.categories, '/Users/zcol/Project/SkillsManagePlugins/sub', 'Sub')
    expect(category?.name).toBe('DSH 插件')
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
})
