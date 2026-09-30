// Reproducible compatibility build input; never installs into a running profile.
import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const target = path.resolve(process.argv[2] ?? path.join(root, '.staging/sidebar-020-final'))
const settingsNamespace = process.argv[3] ?? 'workspace-groups-sidebar'
if (!/^workspace-groups-[a-z0-9-]+$/.test(settingsNamespace)) throw new Error('Invalid settings namespace')
if (target === root || fs.existsSync(target)) throw new Error('Choose a new, empty staging path')
fs.mkdirSync(target, { recursive: true })
for (const name of ['src', 'tests', 'tsconfig.json', 'tsconfig.client.json', 'tsconfig.build.json', 'tsconfig.test.json', 'tsdown.config.ts', 'vitest.config.ts', 'README.md', 'README_RU.md', 'README_ZH.md', 'LICENSE', 'cordis.patch.yml', 'workspace-groups.example.yaml']) {
  fs.cpSync(path.join(root, name), path.join(target, name), { recursive: true })
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
manifest.version = '0.2.0-rc.1-sidebar.1'
for (const section of ['peerDependencies', 'devDependencies']) {
  for (const name of Object.keys(manifest[section])) {
    if (name.startsWith('@deepseek-ai/dsh-')) manifest[section][name] = '0.2.0-rc.1'
  }
}
manifest.scripts.typecheck = 'tsc -p tsconfig.json --noEmit && tsc -p tsconfig.client.json --noEmit'
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
function change(name, fn) {
  const file = path.join(target, name)
  fs.writeFileSync(file, fn(fs.readFileSync(file, 'utf8')))
}
function replace(text, from, to) {
  if (!text.includes(from)) throw new Error(`Expected source missing: ${from}`)
  return text.replace(from, to)
}
const icons = /\b(Icon\w+?)(?:14|16|20)\b/g
for (const name of ['ColorMenu.tsx', 'DirectoryBrowser.tsx', 'GroupsBrowser.tsx', 'rows.tsx']) {
  change('src/client/' + name, s => s.replace(icons, '$1Medium'))
}
for (const name of ['contract.ts', 'index.ts', 'GroupsBrowser.tsx', 'tree.ts', 'tree-search.ts', 'session-cleanup.ts']) {
  change('src/client/' + name, s => s.replaceAll('SessionPendingInteractionSnapshot', 'SessionStatusSnapshot').replaceAll('useSessionPendingInteraction', 'useSessionStatus'))
}
change('src/client/index.ts', s => {
  s = "import { mainSessionId } from './session-status.ts'\n" + s
  s = s.replaceAll('ctx.sessions.open(', 'ctx.uiWorkspace.openSession(').replaceAll('ctx.uiSession.pendingInteractions', 'ctx.uiSession.sessionStatus')
  return s.replaceAll('currentSessionId: sessions.current', 'currentSessionId: mainSessionId(sessions)')
})
fs.writeFileSync(path.join(target, 'src/client/session-status.ts'), `import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Session-controller replaces byId on retention changes; cache absent selections too.
const selections = new WeakMap<SessionListState['byId'], SessionId | undefined>()
/** Selection belongs to uiWorkspace, represented by mainView retention. */
export function mainSessionId(list: SessionListState): SessionId | undefined {
  if (!selections.has(list.byId)) {
    selections.set(list.byId, Object.values(list.byId).find(session => (session.retainedBy.mainView ?? 0) > 0)?.id)
  }
  return selections.get(list.byId)
}
`)
for (const name of ['GroupsBrowser.tsx', 'tree.ts', 'tree-search.ts']) {
  change('src/client/' + name, s => "import { mainSessionId } from './session-status.ts'\n" + s.replaceAll('list.current', 'mainSessionId(list)'))
}
change('src/client/tree.ts', s => {
  s = replace(s, 'pendingInteractions.get(s.id)?.kind', 'pendingInteractions.get(s.id)?.pendingInteraction?.kind')
  s = replace(s, '    running: s.running,', "    running: pendingInteractions.get(s.id)?.running === true || s.running,")
  s = replace(s, '(s.completed === true || completedOverride === true)', '(pendingInteractions.get(s.id)?.completionUnread === true || completedOverride === true)')
  s = replace(s, '  archivedSessionIds: readonly SessionId[],\n): SessionCompletionObservation[]', '  archivedSessionIds: readonly SessionId[],\n  pendingInteractions: SessionStatusSnapshot = new Map(),\n): SessionCompletionObservation[]')
  s = replace(s, 'summary.running || runningSubagentCount > 0', "pendingInteractions.get(id)?.running === true || summary.running || runningSubagentCount > 0")
  s = replace(s, 'mainSessionId(list) !== undefined && workspace.sessionIds.includes(mainSessionId(list))', 'mainSessionId(list) !== undefined && workspace.sessionIds.includes(mainSessionId(list)!)')
  return replace(s, 'completed: summary.completed === true', 'completed: pendingInteractions.get(id)?.completionUnread === true')
})
change('src/client/GroupsBrowser.tsx', s => {
  s = replace(s, 'deriveCompletionObservations(list, archivedSessionIds)', 'deriveCompletionObservations(list, archivedSessionIds, pendingInteractions)')
  return replace(s, '[actions, archivedSessionIds, current, list, workspacePhase]', '[actions, archivedSessionIds, current, list, pendingInteractions, workspacePhase]')
})
change('src/client/session-cleanup.ts', s => replace(s, 'options.pendingInteractions.has(session.id)', "(options.pendingInteractions.get(session.id)?.pendingInteraction !== undefined || options.pendingInteractions.get(session.id)?.running === true)"))
change('src/context-types.ts', s => replace(s, `  register(namespace: string, schema: unknown, options?: { applies?: 'live' | 'restart' }): {\n    get(): unknown\n    update(patch: object): Promise<void>\n  }`, '  update(namespace: string, patch: object): Promise<void>'))
change('src/index.ts', s => {
  s = replace(s, "const FILTER_SETTINGS_NAMESPACE = 'dsh-workspace-groups'", `const FILTER_SETTINGS_NAMESPACE = '${settingsNamespace}'`)
  s = replace(s, '/** Error with an HTTP status', "export const Config = Schema.object({ filter: FILTER_PREFERENCES_SCHEMA.default(DEFAULT_SIDEBAR_FILTER).volatile() })\n\n/** Error with an HTTP status")
  s = replace(s, 'export function apply(ctx: GroupsContext): void', 'export function apply(ctx: GroupsContext, config: { filter: { get(): SidebarFilterPreferences } }): void')
  s = replace(s, "    const scope = settings.register(FILTER_SETTINGS_NAMESPACE, FILTER_PREFERENCES_SCHEMA, { applies: 'live' })\n", '')
  return s.replaceAll('scope.get()', 'config.filter.get()').replaceAll('scope.update(filter)', "settings.update(FILTER_SETTINGS_NAMESPACE, { filter })")
})
change('tests/rows.dom.test.tsx', s => {
  s = s.replace(icons, '$1Medium').replaceAll('useSessionPendingInteraction', 'useSessionStatus')
  s = replace(s, "s1: { id: 's1', displayTitle: 'Failed session', blank: false, running: false, completed: true, updatedAt: 1,", "s1: { id: 's1', retainedBy: { mainView: 1 }, displayTitle: 'Failed session', blank: false, running: false, updatedAt: 1,")
  s = replace(s, "s2: { id: 's2', displayTitle: 'Other session', blank: false, running: false, updatedAt: 1 }", "s2: { id: 's2', retainedBy: {}, displayTitle: 'Other session', blank: false, running: false, updatedAt: 1 }")
  s = replace(s, "open={id => { list = { ...list, current: id }; render() }}", "open={id => { list = { ...list, byId: Object.fromEntries(Object.entries(list.byId).map(([key, value]) => [key, { ...value, retainedBy: key === id ? { mainView: 1 } : {} }])) } as SessionListState; render() }}")
  // Compatible scoped fixtures without inherited selection.
  return s.replaceAll("displayTitle: 'S1', blank:", "retainedBy: {}, displayTitle: 'S1', blank:")
})
change('tests/host-routes.test.ts', s => {
  s = replace(s, 'apply(mockCtx)', 'apply(mockCtx, { filter: { get: () => settingsValue } })')
  const start = s.indexOf('    mount({\n      register:')
  const end = s.indexOf('\n\n    server =', start)
  if (start < 0 || end < 0) throw new Error('Expected settings test fixture')
  return s.slice(0, start) + `    mount({ update: async (_namespace, patch) => {\n      settingsValue = { ...settingsValue, ...(patch as { filter: SidebarFilterPreferences }).filter }\n    } })` + s.slice(end)
})
fs.copyFileSync(path.join(root, 'scripts/compat020/pnpm-lock.yaml'), path.join(target, 'pnpm-lock.yaml'))
console.log(`Prepared compatible source at ${target}; run pnpm install --ignore-scripts --frozen-lockfile, build and verify before any deployment.`)
