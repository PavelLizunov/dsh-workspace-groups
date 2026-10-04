import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

function generatedSelection() {
  const parent = mkdtempSync(path.join(tmpdir(), 'wg-020-selection-'))
  try {
    const target = path.join(parent, 'candidate')
    const root = path.resolve(import.meta.dirname, '..')
    const prepared = path.join(root, 'src/client/session-status.ts')
    let source: string
    if (existsSync(prepared)) {
      source = readFileSync(prepared, 'utf8')
    } else {
      execFileSync(process.execPath, ['scripts/prepare-020.mjs', target], { cwd: root })
      source = readFileSync(path.join(target, 'src/client/session-status.ts'), 'utf8')
    }
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
    const exports: { mainSessionId?: (list: { byId: object }) => string | undefined } = {}
    vm.runInNewContext(js, { exports })
    return exports.mainSessionId!
  } finally {
    rmSync(parent, { recursive: true, force: true })
  }
}

const mainSessionId = generatedSelection()
const row = (id: string, count = 0) => ({ id, retainedBy: { mainView: count } })

describe('0.2 generated sidebar selection', () => {
  it('adapts scope-filter icons to published 0.2 primitive names', () => {
    const parent = mkdtempSync(path.join(tmpdir(), 'wg-020-icons-'))
    try {
      const target = path.join(parent, 'candidate')
      execFileSync(process.execPath, ['scripts/prepare-020.mjs', target], { cwd: process.cwd() })
      const source = readFileSync(path.join(target, 'src/client/ScopeFilter.tsx'), 'utf8')
      expect(source).toContain('IconFolderCloseMedium')
      expect(source).toContain('IconChevronDownOutlineMedium')
      expect(source).not.toMatch(/IconFolderClose16|IconChevronDownOutline14/)
    } finally {
      rmSync(parent, { recursive: true, force: true })
    }
  })
  it('returns the retained main-view session independently for each snapshot', () => {
    expect(mainSessionId({ byId: { a: row('a'), b: row('b', 1) } })).toBe('b')
    expect(mainSessionId({ byId: { c: row('c', 2) } })).toBe('c')
    expect(mainSessionId({ byId: {} })).toBeUndefined()
  })

  it('recomputes after immutable selection changes', () => {
    const byId = { a: row('a', 1), b: row('b') }
    expect(mainSessionId({ byId })).toBe('a')
    expect(mainSessionId({ byId: { ...byId, a: row('a'), b: row('b', 1) } })).toBe('b')
    expect(mainSessionId({ byId: { a: row('a'), b: row('b') } })).toBeUndefined()
  })

  it.each([true, false])('enumerates a 5000-session snapshot once, selected=%s', selected => {
    let enumerations = 0
    const rows = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [String(i), row(String(i), selected && i === 4999 ? 1 : 0)]))
    const byId = new Proxy(rows, { ownKeys(target) { enumerations++; return Reflect.ownKeys(target) } })
    for (let i = 0; i < 5000; i++) {
      expect(mainSessionId({ byId })).toBe(selected ? '4999' : undefined)
    }
    expect(enumerations).toBe(1)
  })
})
