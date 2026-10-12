import fs from 'node:fs'
import ts from 'typescript'
const [input, output] = process.argv.slice(2)
if (!input || !output || fs.existsSync(output)) throw new Error('Supply installed input and new output')
let source = fs.readFileSync(input, 'utf8')
if (source.includes('function installNewSessionDraft(')) throw new Error('Draft handler already installed')
const anchor = 'function apply(ctx) {'
if (source.indexOf(anchor) < 0 || source.indexOf(anchor) !== source.lastIndexOf(anchor)) throw new Error('Overlay apply contract changed')
const helper = ts.transpileModule(fs.readFileSync(new URL('../src/client/new-session-draft.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace('export function ', 'function ')
source = source.replace(anchor, helper + '\n' + anchor + '\n ctx.effect(() => installNewSessionDraft(ctx), "workspace-groups: immediate new-session draft");')
const plus = '"aria-label": `${t("session.new")} ${node.label}`,'
if (!source.includes(plus)) throw new Error('Workspace plus anchor missing')
source = source.replace(plus, plus + '\n "data-wg-new-session": "",')
fs.writeFileSync(output, source)
console.log('Built filter-independent offline draft intake')
