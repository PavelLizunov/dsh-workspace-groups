// Preserve the installed overlay; add only the native plus action.
import fs from 'node:fs'
import ts from 'typescript'
const [input, output] = process.argv.slice(2)
if (!input || !output || fs.existsSync(output)) throw new Error('Supply installed input and new output; deployment is separate')
let source = fs.readFileSync(input, 'utf8')
if (source.includes('function installNativeNewSession(')) throw new Error('Native action already installed')
const anchor = 'function apply(ctx) {'
if (source.indexOf(anchor) < 0 || source.indexOf(anchor) !== source.lastIndexOf(anchor)) throw new Error('Overlay apply contract changed')
const helper = ts.transpileModule(fs.readFileSync(new URL('../src/client/native-new-session.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import[^\n]+\n/gm, '').replace('export function ', 'function ')
if (!source.includes('function revealMobileConversation(')) throw new Error('Existing mobile reveal helper missing')
source = source.replace(anchor, helper + '\n' + anchor + '\n ctx.effect(() => installNativeNewSession(ctx), "workspace-groups: fresh native new session");')
fs.writeFileSync(output, source)
console.log('Built fresh native session action without replacement UI')
