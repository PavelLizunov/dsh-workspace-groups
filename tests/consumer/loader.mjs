/** Real DSH loader regression; platform exports are mocked, no browser/server is started. */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, '../..')
const frontendRoot = path.dirname(require.resolve('@deepseek-ai/dsh-web-frontend/package.json'))
const assets = path.join(frontendRoot, 'dist/assets')
const shell = fs.readdirSync(assets).filter(name => /^index-.*\.js$/.test(name))
  .map(name => fs.readFileSync(path.join(assets, name), 'utf8')).join('\n')
const platformIds = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives',
]
// Check the installed target shell, not just the build configuration's allowlist.
for (const id of platformIds) assert(shell.includes(id === 'react' ? '{react:' : `"${id}":`), `target shell lacks ${id}`)
assert(!shell.includes('"@deepseek-ai/dsh-client-runtime/client":'))

function registration(source, filename) {
  let row
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load: value => { row = value } } },
    document: { querySelectorAll: () => [] },
  }, { filename })
  assert.equal(typeof row?.factory, 'function')
  return row
}
const loaderFile = require.resolve('@deepseek-ai/dsh-client-modules/client')
const loaderRow = registration(fs.readFileSync(loaderFile, 'utf8'), loaderFile)
const loader = loaderRow.factory(id => { throw new Error(`Unexpected loader dependency: ${id}`) })
const seed = Object.fromEntries(platformIds.map(id => [id, id === 'react' || id === 'react/jsx-runtime' ? require(id) : {}]))
async function load(row) {
  const system = new loader.ClientModuleSystem({
    manifest: { modules: [] }, staticModules: seed,
    bootstrapModule: { id: loaderRow.id, exports: loader },
    registrationTarget: { mode: 'queue', pendingQueue: [row] },
  })
  return system.import(row.id)
}
// Reproduce the failed external in isolation, without reverting files or touching the live GUI.
await assert.rejects(load({
  id: 'legacy-workspace-groups',
  factory: require => require('@deepseek-ai/dsh-client-runtime/client'),
}), /missed the module table/)
const file = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'lib/client.js')
const client = fs.readFileSync(file, 'utf8')
for (const [, id] of client.matchAll(/require\(["']([^"']+)["']\)/g)) {
  assert(platformIds.includes(id), `unexpected client external: ${id}`)
}
const plugin = await load(registration(client, file))
assert.equal(typeof plugin.apply, 'function')
assert(plugin.inject.includes('uiWorkspace'))
assert(plugin.inject.includes('uiSession'))
assert(!plugin.inject.includes('connection'))
console.log('Loader: legacy external rejected; built plugin imports against DSH 0.1.5 shell module IDs.')
console.log('Scope: real loader/factory, mocked platform exports; not an authenticated browser lifecycle test.')
