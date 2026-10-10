// Never move a New Session button before its synthesized click reaches React.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
export function patchNewSessionMobile(source) {
  const pointer = `            if (!shouldCloseOnTapInsideDrawer(target))
                return;
            const row = target.closest('[role="treeitem"]');`
  const click = `            if (performance.now() - lastTouchNavAt < 500)
                return;
            if (shouldCloseOnTapInsideDrawer(event.target))
                toggleSidebar();`
  if (!source.includes(pointer) || !source.includes(click)) throw new Error('Mobile new-session interaction contract changed')
  source = source.replace(pointer, `            // Keep the button mounted until the browser delivers its click.
            if (target.closest('[class*="newSession"]') !== null)
                return;
${pointer}`)
  return source.replace(click, `            if (performance.now() - lastTouchNavAt < 500)
                return;
            if (shouldCloseOnTapInsideDrawer(event.target)) {
                if (event.target instanceof Element && event.target.closest('[class*="newSession"]') !== null) {
                    // Capture runs before React; close after the complete click dispatch.
                    window.setTimeout(() => { if (drawerOpen()) toggleSidebar(); }, 0);
                    return;
                }
                toggleSidebar();
            }`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2)
  if (!input || !output || path.resolve(input) === path.resolve(output) || fs.existsSync(output)) throw new Error('Supply existing input and new output; deployment is separate')
  fs.writeFileSync(output, patchNewSessionMobile(fs.readFileSync(input, 'utf8')))
  console.log('Patched top New Session touch ordering')
}
