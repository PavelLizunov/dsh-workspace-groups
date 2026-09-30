import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const dir=path.resolve(process.argv[2]);const require=createRequire(path.join(dir,'package.json'))
const ids=['react','react/jsx-runtime','react-dom','react-dom/client','@deepseek-ai/cordis','@deepseek-ai/dsh-client-store','@deepseek-ai/dsh-client-ui-slots','@deepseek-ai/dsh-client-ui-primitives']
function row(file){let entry;vm.runInNewContext(fs.readFileSync(file,'utf8'),{window:{__ModuleLoader__:{load:x=>{entry=x}}},document:{querySelectorAll:()=>[]}},{filename:file});assert.equal(typeof entry?.factory,'function');return entry}
const loaderRow=row(require.resolve('@deepseek-ai/dsh-client-modules/client'));const loader=loaderRow.factory(id=>{throw Error(id)})
const file=path.join(dir,'lib/client.js'),source=fs.readFileSync(file,'utf8');for(const [,id]of source.matchAll(/require\(["']([^"']+)["']\)/g))assert(ids.includes(id),id)
const pluginRow=row(file);const system=new loader.ClientModuleSystem({manifest:{modules:[]},staticModules:Object.fromEntries(ids.map(id=>[id,id.startsWith('react')?require(id):{}])),bootstrapModule:{id:loaderRow.id,exports:loader},registrationTarget:{mode:'queue',pendingQueue:[pluginRow]}})
const plugin=await system.import(pluginRow.id);assert.equal(typeof plugin.apply,'function');assert(plugin.inject.includes('uiWorkspace'))
console.log('PASS actual 0.2 ClientModuleSystem; factory imports, platform services mocked')
