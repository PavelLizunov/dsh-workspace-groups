import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const contractPath = path.resolve(__dirname, '../src/client/contract.ts')
const clientIndexPath = path.resolve(__dirname, '../src/client/index.ts')
const rowsPath = path.resolve(__dirname, '../src/client/rows.tsx')
const browserPath = path.resolve(__dirname, '../src/client/GroupsBrowser.tsx')
const stylesPath = path.resolve(__dirname, '../src/client/styles.css')
const directoryBrowserPath = path.resolve(__dirname, '../src/client/DirectoryBrowser.tsx')
const verifyGroupsPath = path.resolve(__dirname, '../scripts/verify-groups.mjs')

const contractSource = fs.readFileSync(contractPath, 'utf-8')
const clientIndexSource = fs.readFileSync(clientIndexPath, 'utf-8')
const rowsSource = fs.readFileSync(rowsPath, 'utf-8')
const browserSource = fs.readFileSync(browserPath, 'utf-8')
const stylesSource = fs.readFileSync(stylesPath, 'utf-8')
const directoryBrowserSource = fs.readFileSync(directoryBrowserPath, 'utf-8')
const verifyGroupsSource = fs.readFileSync(verifyGroupsPath, 'utf-8')

function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`)
  if (start === -1) return ''
  const nextFunction = source.indexOf('export function ', start + name.length)
  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction)
}

function extractElementTag(source: string, tagName: string): string {
  const start = source.indexOf(`<${tagName}`)
  if (start === -1) return ''
  const end = source.indexOf('>', start)
  return end === -1 ? '' : source.slice(start, end + 1)
}

describe('redesign source contracts: contract.ts and index.ts', () => {
  it('contains no direct pickDirectory invocation or prop', () => {
    expect(contractSource).not.toMatch(/\bpickDirectory\b/)
    expect(clientIndexSource).not.toMatch(/\bpickDirectory\b/)
  })

  it('propagates fork errors instead of swallowing them', () => {
    expect(contractSource).toMatch(/forkSession:\s*\(sessionId: SessionId\) => Promise<void>/)
    expect(clientIndexSource).not.toMatch(/\.catch\(\(\) => \{\}\)/)
  })

  it('exposes listDirectory and createDirectory callbacks', () => {
    expect(contractSource).toMatch(/\blistDirectory\s*:/)
    expect(contractSource).toMatch(/\bcreateDirectory\s*:/)
    expect(clientIndexSource).toMatch(/\blistDirectory\s*:/)
    expect(clientIndexSource).toMatch(/\bcreateDirectory\s*:/)
  })
})

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

  it('category root section contains no draggable or onDragStart', () => {
    const rootTag = extractElementTag(categoryRowSrc, 'div')
    expect(rootTag).not.toMatch(/\bdraggable\b/)
    expect(rootTag).not.toMatch(/\bonDragStart\b/)
  })

  it('category drag handle has draggable and onDragStart attributes', () => {
    expect(categoryRowSrc).toMatch(/data-wg-drag-handle=["']category["']/)
    const handleMatch = categoryRowSrc.match(/<[^>]*data-wg-drag-handle=["']category["'][^>]*>/)
    expect(handleMatch).not.toBeNull()
    const handleTag = handleMatch ? handleMatch[0] : ''
    expect(handleTag).toMatch(/\bdraggable\b/)
    expect(handleTag).toMatch(/\bonDragStart\b/)
  })

  it('category drag handle is non-button or has -webkit-user-drag without pointerdown/mousedown stopPropagation', () => {
    const handleMatch = rowsSource.match(/<([a-zA-Z0-9]+)[^>]*data-wg-drag-handle=["']category["'][^>]*>/)
    expect(handleMatch).not.toBeNull()
    const tagName = handleMatch ? handleMatch[1] : ''
    const handleTag = handleMatch ? handleMatch[0] : ''

    if (tagName === 'button') {
      expect(stylesSource).toMatch(/-webkit-user-drag\s*:/)
      expect(handleTag).not.toMatch(/onPointerDown\s*=\s*\{[^}]*stopPropagation/)
      expect(handleTag).not.toMatch(/onMouseDown\s*=\s*\{[^}]*stopPropagation/)
    } else {
      expect(tagName).not.toBe('button')
    }
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

  it('contains no direct pickDirectory invocation or prop', () => {
    expect(browserSource).not.toMatch(/\bpickDirectory\b/)
  })

  it('owns a directory browse dialog path using listDirectory and createDirectory', () => {
    expect(browserSource).toMatch(/\blistDirectory\b/)
    expect(browserSource).toMatch(/\bcreateDirectory\b/)
  })

  it('uses one shared moveWorkspaceTo path for DnD and menu moves', () => {
    expect(browserSource).toContain('onMoveTo={(workspaceId, categoryKey) => { void moveWorkspaceTo(workspaceId, categoryKey) }}')
    expect(browserSource).toContain('moveWorkspaceTo(workspaceId, categoryKey, beforeWsid, afterWsid)')
  })

  it('routes Workspace moves through the shared overlay mutation', () => {
    expect(browserSource).toContain('moveWorkspaceOverlay(manual')
    expect(browserSource).toContain('targetMembers')
  })

  it('gates tree, search, and categories behind wide', () => {
    expect(browserSource).toMatch(/\{wide\s*&&[\s\S]*?(?:wgTreeBody|wgList|CategorySection|SearchBody)/)
  })

  it('renders New Group button only in wide mode', () => {
    expect(browserSource).toMatch(/\{wide\s*&&[\s\S]*?(?:group\.create|setGroupDialog)/)
  })

  it('preserves Add Workspace action and rail Search button', () => {
    expect(browserSource).toMatch(/t\(['"]workspace\.add['"]\)|addWorkspace/)
    expect(browserSource).toMatch(/!wide\s*&&[\s\S]*?(?:expandSidebar|t\(['"]search['"]\))/)
  })

  it('group dragstart does not call setCategoryExpanded or temporaryCategories', () => {
    const dragStartCategoryIndex = browserSource.indexOf('onDragStartCategory')
    expect(dragStartCategoryIndex).toBeGreaterThan(-1)
    const dragStartCategorySrc = browserSource.slice(
      dragStartCategoryIndex,
      browserSource.indexOf('const now = Date.now()', dragStartCategoryIndex),
    )
    expect(dragStartCategorySrc).not.toMatch(/setCategoryExpanded/)
    expect(dragStartCategorySrc).not.toMatch(/temporaryCategories/)
  })

  it('provides append target with data-wg-category-drop-end attribute', () => {
    expect(browserSource).toMatch(/data-wg-category-drop-end/)
  })

  it('wires real actions into SearchBody instead of empty callbacks', () => {
    const searchBody = browserSource.slice(browserSource.indexOf('function SearchBody'))
    expect(searchBody).not.toMatch(/on(?:NewSession|Rename|Delete|Fork|Archive)=\{\(\) => \{\}\}/)
    expect(searchBody).toContain('onWorkspaceRename')
    expect(searchBody).toContain('onWorkspaceDelete')
    expect(searchBody).toContain('onSessionFork')
    expect(searchBody).toContain('onSessionArchive')
  })

  it('guards pending dialogs and async settlements', () => {
    expect(browserSource).toContain('renameGeneration')
    expect(browserSource).toContain('deleteGeneration')
    expect(browserSource).toContain('sessionRenameGeneration')
    expect(browserSource).toContain('groupGeneration')
    expect(browserSource).toContain('groupDeleteGeneration')
    expect(browserSource).toMatch(/onClose=\{\(\) => \{ if \(!renaming\)/)
    expect(browserSource).toMatch(/disabled=\{renaming\}/)
    expect(browserSource).toMatch(/disabled=\{sessionRenaming\}/)
  })

  it('cleans all order references in the production overlay helper', () => {
    expect(browserSource).toContain("from './overlay-core.ts'")
  })
})

describe('directory browser source contracts', () => {
  it('never joins path segments client-side', () => {
    expect(directoryBrowserSource).not.toMatch(/path\.join|resolve\(|`\$\{[^}]*path[^}]*\}[\\/]/)
  })

  it('aborts superseded requests and guards stale settlements', () => {
    expect(directoryBrowserSource).toContain('AbortController')
    expect(directoryBrowserSource).toContain('requestSeq')
    expect(directoryBrowserSource).toContain('openGeneration')
  })

  it('supports navigation, cancel, retry, and folder creation', () => {
    expect(directoryBrowserSource).toContain('listDirectory')
    expect(directoryBrowserSource).toContain('createDirectory')
    expect(directoryBrowserSource).toContain('strings.retry')
    expect(directoryBrowserSource).toContain('onClose')
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

  it('contains drag handle visibility, focus, and coarse pointer rules', () => {
    expect(stylesSource).toMatch(/\[data-wg-drag-handle=["']?category["']?\]|\.wgDragHandle\b/)
    expect(stylesSource).toMatch(/(?:\[data-wg-drag-handle|\.wgDragHandle).*?:focus-visible|:focus-visible.*?(?:\[data-wg-drag-handle|\.wgDragHandle)/s)
    expect(stylesSource).toMatch(/@media[^{]*(?:pointer:\s*coarse|hover:\s*none)[^{]*\{[^}]*(?:\[data-wg-drag-handle|\.wgDragHandle)/s)
  })
})

describe('verification script source contracts: verify-groups.mjs', () => {
  it('targets drag handle and asserts MIME type in drag tests', () => {
    expect(verifyGroupsSource).toMatch(/data-wg-drag-handle|\.wgDragHandle/)
    expect(verifyGroupsSource).toMatch(/application\/x-dsh-workspace-groups/)
  })
})
