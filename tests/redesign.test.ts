import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const rowsPath = path.resolve(__dirname, '../src/client/rows.tsx')
const browserPath = path.resolve(__dirname, '../src/client/GroupsBrowser.tsx')
const stylesPath = path.resolve(__dirname, '../src/client/styles.css')

const rowsSource = fs.readFileSync(rowsPath, 'utf-8')
const browserSource = fs.readFileSync(browserPath, 'utf-8')
const stylesSource = fs.readFileSync(stylesPath, 'utf-8')

function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`)
  if (start === -1) return ''
  const nextFunction = source.indexOf('export function ', start + name.length)
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction)
}

describe('redesign source contracts: rows.tsx', () => {
  const categoryRowSrc = extractFunction(rowsSource, 'CategoryRow')
  const workspaceRowSrc = extractFunction(rowsSource, 'WorkspaceRow')
  const sessionRowSrc = extractFunction(rowsSource, 'SessionRow')

  it('category rows have tabIndex and keyboard handlers', () => {
    expect(categoryRowSrc).toMatch(/tabIndex=/)
    expect(categoryRowSrc).toMatch(/onKeyDown=/)
  })

  it('workspace rows have tabIndex and keyboard handlers', () => {
    expect(workspaceRowSrc).toMatch(/tabIndex=/)
    expect(workspaceRowSrc).toMatch(/onKeyDown=/)
  })

  it('session rows have tabIndex and keyboard handlers', () => {
    expect(sessionRowSrc).toMatch(/tabIndex=/)
    expect(sessionRowSrc).toMatch(/onKeyDown=/)
  })

  it('removes generic category aria-label', () => {
    expect(categoryRowSrc).not.toMatch(/aria-label=\{t\(['"]section\.workspaces['"]\)\}/)
  })

  it('preserves data-wg-category on category rows and data-wsid on workspace rows', () => {
    expect(categoryRowSrc).toMatch(/data-wg-category=\{node\.key\}/)
    expect(workspaceRowSrc).toMatch(/data-wsid=\{node\.workspaceId\}/)
  })

  it('includes wgMenuOpen and accurate action-menu labels', () => {
    expect(rowsSource).toMatch(/wgMenuOpen/)
    expect(rowsSource).toContain("t('group.actions')")
    expect(rowsSource).toContain("t('workspace.actions')")
    expect(rowsSource).toContain("t('session.actions')")
  })

  it('marks only the selected session as current', () => {
    expect(categoryRowSrc).not.toContain('aria-current')
    expect(workspaceRowSrc).not.toContain('aria-current')
    expect(sessionRowSrc).toContain('aria-current')
  })
})

describe('redesign source contracts: GroupsBrowser.tsx', () => {
  it('search input has aria-label attribute', () => {
    const inputStart = browserSource.lastIndexOf('<input', browserSource.indexOf('wgSearchInput'))
    expect(inputStart).toBeGreaterThan(-1)
    const inputEnd = browserSource.indexOf('/>', inputStart)
    const inputSnippet = browserSource.slice(inputStart, inputEnd + 2)
    expect(inputSnippet).toMatch(/aria-label=/)
  })

  it('header action and hidden classes exist', () => {
    expect(browserSource).toContain('wgHeaderActions')
    expect(browserSource).toContain('wgHeaderActionsHidden')
    expect(browserSource).toContain('wgSectionLabelHidden')
  })
})

describe('redesign source contracts: styles.css', () => {
  it('uses official alias CSS tokens', () => {
    expect(stylesSource).toMatch(/var\(--dsw-alias-label-primary/)
    expect(stylesSource).toMatch(/var\(--dsw-alias-interactive-bg-hover/)
    expect(stylesSource).toMatch(/var\(--dsw-alias-state-business-primary/)
  })

  it('defines 34px and 32px row sizes', () => {
    expect(stylesSource).toMatch(/34px/)
    expect(stylesSource).toMatch(/32px/)
  })

  it('provides focus-visible styling', () => {
    expect(stylesSource).toMatch(/:focus-visible/)
    expect(stylesSource).toContain('.wgSearchExpanded:focus-within')
  })

  it('ensures action visibility on coarse pointer devices', () => {
    expect(stylesSource).toMatch(/@media\s*\(\s*pointer:\s*coarse\s*\)|pointer:\s*coarse/)
  })

  it('preserves DnD and drop target selectors', () => {
    expect(stylesSource).toMatch(/\.wgDropTarget\b/)
    expect(stylesSource).toMatch(/\.wgInsertBefore\b/)
    expect(stylesSource).toMatch(/\.wgInsertAfter\b/)
    expect(stylesSource).toMatch(/\.wgTopLevelArea\b/)
    expect(stylesSource).toMatch(/\.wgTopLevelEmpty\b/)
    expect(stylesSource).toMatch(/\.wgTopLevelEmptyLine\b/)
    expect(stylesSource).toMatch(/\.wgTopLevelEmptyActive\b/)
  })
})
