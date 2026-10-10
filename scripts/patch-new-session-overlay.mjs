// Preserve the user's installed sidebar overlay; change only known navigation anchors.
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { pathToFileURL } from 'node:url'

export function patchNewSessionOverlay(source) {
  const helper = ts.transpileModule(fs.readFileSync(new URL('../src/client/new-session.ts', import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replaceAll('export function ', 'function ')
  function replace(before, after) {
    if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) throw new Error(`Overlay contract changed: ${before}`)
    source = source.replace(before, after)
  }
  replace('function GroupsBrowser({ closeSidebar, wide, expandSidebar, useSessions, useSessionStatus, useWorkspaces, useStore, actions, startSession, openWorkspace,', helper + '\nfunction GroupsBrowser({ closeSidebar, wide, expandSidebar, useSessions, useSessionStatus, useWorkspaces, useStore, actions, startSession: nativeStartSession, openWorkspace,')
  replace('const [config, setConfig] = (0, react.useState)({ categories: [] });', `const [newSessionError, setNewSessionError] = (0, react.useState)(null);
      const startSession = (0, react.useMemo)(() => createSessionStarter(
        (workspaceId, beforeOpen) => openWorkspace(workspaceId, beforeOpen),
        nativeStartSession, setNewSessionError
      ), [openWorkspace, nativeStartSession]);
      const [config, setConfig] = (0, react.useState)({ categories: [] });`)
  replace('openWorkspace: (workspaceId) => ctx.uiWorkspace.openWorkspace(workspaceId),', 'openWorkspace: (workspaceId, beforeOpen) => ctx.uiWorkspace.openWorkspace(workspaceId, beforeOpen),')
  replace('manualError !== null && !conflictError &&', 'newSessionError !== null && (0, react_jsx_runtime.jsx)("div", {className: "wgSearchStatus wgManualError", role: "alert", children: t("session.new") + ": " + newSessionError}),\n manualError !== null && !conflictError &&')
  return source
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2)
  if (!input || !output || path.resolve(input) === path.resolve(output) || fs.existsSync(output)) throw new Error('Supply existing input and new output; deployment is separate')
  fs.writeFileSync(output, patchNewSessionOverlay(fs.readFileSync(input, 'utf8')))
  console.log('Patched new-session navigation without replacing the overlay')
}
