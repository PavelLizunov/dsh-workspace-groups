// Extend the installed mobile client without replacing its existing patches.
import fs from 'node:fs'
import path from 'node:path'
import { patchGroupedNavigation } from '../packages/mobile-shortcuts/navigation-compat.mjs'
import { build } from '/var/lib/dsh/DSH-creator/deepseek-harness/node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/lib/main.js'
const root = path.resolve(import.meta.dirname, '..')
const live = '/var/lib/dsh/.dsh-releases/v020-rc2/profile/node_modules/dsh-web-mobile'
const output = path.resolve(process.argv[2] ?? path.join(root,'.staging/mobile-camera/package'))
const baseline = process.env.DSH_MOBILE_BASELINE ?? path.join(live,'lib/client.js')
const current = fs.readFileSync(baseline,'utf8')
if(current.includes('mobile-shortcuts.js')) throw new Error('Use the saved baseline, not an already extended bundle')
const result = await build({entryPoints:[path.join(root,'packages/mobile-shortcuts/entry.ts')],bundle:true,write:false,format:'cjs',platform:'browser',jsx:'automatic',external:['react','react-dom','react/jsx-runtime','@deepseek-ai/*'],target:'es2022'})
const module = `__modules["mobile-shortcuts.js"] = function(require,module,exports){\n${result.outputFiles[0].text}\n};\n`
const anchor = '__modules["index.js"] = function(require,module,exports){'
if(!current.includes(anchor)) throw new Error('Mobile module loader changed')
const effectAnchor = '    (0, phone_chrome_ts_1.installPhoneChrome)(ctx);'
if(!current.includes(effectAnchor)) throw new Error('Mobile apply contract changed')
const css = fs.readFileSync(path.join(root,'packages/mobile-shortcuts/shortcuts.css'),'utf8')
const effect = `    ctx.effect(() => { const style = document.createElement('style'); style.dataset.dshMobileShortcuts = ''; style.textContent = ${JSON.stringify(css)}; document.head.append(style); return () => style.remove(); });\n    ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({name: 'conversation.input.overlay', id: 'dsh-web-mobile:quick-photo-panel', order: -10, registrant: 'dsh-web-mobile'}, require('./mobile-shortcuts.js').MobileShortcuts));\n    ctx.slots.inject('shell.overlay', () => ctx.slots.register({name: 'shell.overlay', id: 'dsh-web-mobile:panel-return', order: 10, registrant: 'dsh-web-mobile'}, require('./mobile-shortcuts.js').PanelReturn));\n`
const patched = patchGroupedNavigation(current).replace(anchor,module+anchor).replace(effectAnchor,effect+effectAnchor)
  .replaceAll('.IconPanelLeftOutline16', '.IconPanelLeftOutlineRegular')
  .replaceAll('.IconFolderOpenOutline16', '.IconFolderOpenOutlineRegular')
  .replaceAll('.IconDownloadOutline16', '.IconDownloadOutlineRegular')
fs.mkdirSync(output,{recursive:true})
for(const name of ['package.json','cordis.patch.yml','README.md','LICENSE','src','lib']) fs.cpSync(path.join(live,name),path.join(output,name),{recursive:true})
fs.writeFileSync(path.join(output,'lib/client.js'),patched)
const manifestPath = path.join(output,'package.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath,'utf8'))
manifest.version = '2.3.1-local.20261007.1'
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n')
console.log(`Built extended mobile client: ${output}`)
