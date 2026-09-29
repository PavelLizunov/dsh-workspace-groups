import { describe, it, expect } from 'vitest'
import { parseManualGroups, validateManualGroups } from '../src/host-manual.ts'
import { setFolderIcon, renameGroup, removeGroup, removeWorkspace, moveWorkspace } from '../src/client/overlay-core.ts'
import { FOLDER_ICON_IDS } from '../src/core/icons.ts'
import { TABLER_ICONS } from '../src/client/icons/tabler-data.ts'

const manual = { categories: ['shared'], assignments: { shared: 'shared' } }
describe('folder icon persistence', () => {
  it('keeps group and workspace identifiers in separate namespaces', () => {
    const selected = setFolderIcon(setFolderIcon(manual, 'group', 'shared', 'book'), 'workspace', 'shared', 'server')
    const restored = parseManualGroups(JSON.parse(JSON.stringify(selected)))
    expect(restored.groupIcons).toEqual({ shared: 'book' })
    expect(restored.workspaceIcons).toEqual({ shared: 'server' })
    validateManualGroups(restored, [])
    expect(setFolderIcon(restored, 'group', 'shared', null).groupIcons).toEqual({})
    expect(moveWorkspace(restored, { workspaceId: 'shared', targetCategoryKey: null }).workspaceIcons).toEqual({ shared: 'server' })
  })
  it('migrates renamed group icons and cleans only the deleted namespace', () => {
    const selected = setFolderIcon(setFolderIcon(manual, 'group', 'shared', 'book'), 'workspace', 'shared', 'server')
    const renamed = renameGroup(selected, 'shared', 'Books')
    expect(renamed.groupIcons).toEqual({ Books: 'book' })
    expect(renamed.workspaceIcons).toEqual({ shared: 'server' })
    expect(removeGroup(renamed, 'Books').groupIcons).toEqual({})
    expect(removeWorkspace(selected, 'shared').workspaceIcons).toEqual({})
    expect(removeWorkspace(selected, 'shared').groupIcons).toEqual({ shared: 'book' })
  })
  it('accepts legacy data and rejects unknown IDs or malformed maps', () => {
    expect(parseManualGroups(manual)).toEqual(manual)
    for (const invalid of ['<svg onload=alert(1)>', 'https://example.com/icon.svg', null, 1]) {
      expect(() => parseManualGroups({ ...manual, groupIcons: { shared: invalid } })).toThrow()
    }
    for (const value of [[], null, 'server']) expect(() => parseManualGroups({ ...manual, workspaceIcons: value })).toThrow()
    expect(() => validateManualGroups({ ...manual, groupIcons: { missing: 'book' } }, [])).toThrow(/unknown category/)
  })
  it('treats special map keys as data, not prototype setters', () => {
    const parsed = parseManualGroups(JSON.parse('{"categories":["__proto__"],"assignments":{},"groupIcons":{"__proto__":"book"}}'))
    expect(Object.hasOwn(parsed.groupIcons!, '__proto__')).toBe(true)
    expect(setFolderIcon(manual, 'workspace', '__proto__', 'server').workspaceIcons?.['__proto__']).toBe('server')
    const renamed = renameGroup(setFolderIcon(manual, 'group', 'shared', 'book'), 'shared', '__proto__')
    expect(Object.hasOwn(renamed.groupIcons!, '__proto__')).toBe(true)
    expect(renamed.groupIcons?.['__proto__']).toBe('book')
  })
  it('ships artwork for each allowlisted icon with geometric attributes only', () => {
    expect(Object.keys(TABLER_ICONS)).toEqual([...FOLDER_ICON_IDS])
    for (const shapes of Object.values(TABLER_ICONS)) for (const [tag, attributes] of shapes) {
      expect(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']).toContain(tag)
      expect(Object.keys(attributes).some(key => /^on|href|style/i.test(key))).toBe(false)
    }
  })
})
