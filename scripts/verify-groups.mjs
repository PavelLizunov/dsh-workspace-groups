/**
 * CDP real-browser verification script (dsh-workspace-groups v0.2/v0.3/v0.4/v0.6/v0.7).
 *
 * Usage:
 *   node scripts/verify-groups.mjs [baseUrl] [cdpPort] [chromeBin]
 *
 * Behavior:
 *   - Launches headless Chrome (isolated user-data-dir), opens GUI at baseUrl;
 *   - v0.2: New group modal -> empty group render -> drag project into group -> PUT to disk ->
 *     reload persistence -> invalid PUT 400;
 *   - v0.3: In-group project reordering + collapse other group projects during drag, rule category
 *     "⋯" menu -> rename (persisted to renamed) -> delete (members return to top level + hidden persisted),
 *     no "Uncategorized" bucket in tree;
 *   - v0.4: Drag insertion indicator line (top half = before / bottom half = after): drag project
 *     to target bottom half -> insert after target; drag group down -> move after target group,
 *     drag group up -> move before target group;
 *   - v0.4.1: Drag out of group to top level (top-level drop area shown during drag, drag-out persists null,
 *     top-level row render, in-group project menu "Move out of group");
 *   - v0.6: Level-based collapse + post-drag restore -- dragging project only folds project rows (in-group + top-level),
 *     group rows stay open; dragging group only folds group rows, project rows stay open; dragend restores pre-drag snapshot;
 *   - v0.7: Top-level area uses insertion line indicator (no full-block highlight) -- top-level row reordering,
 *     blank space below last row appends to end; empty top-level shows indicator line below last group row;
 *     top-level order persisted in `workspaceOrder[__topLevel__]`;
 *   - Scene restore: restores original overlay (unlinks if originally absent), leaves no test data behind;
 *   - Depends on running host (PUT /workspace-groups/manual available);
 *   - Exits with 0/1 for quality gates.
 */
import { spawn } from 'node:child_process'
import { mkdtemp, rm, unlink, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.argv[2] ?? 'http://127.0.0.1:3080'
const CDP_PORT = Number(process.argv[3] ?? 9333)
const CHROME = process.argv[4] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const LEGACY_UNCATEGORIZED_ZH = '\u672A\u5206\u7C7B'
const LEGACY_PLUGINS_ZH = '\u63D2\u4EF6'

const results = []
function report(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/** Minimal CDP client over one WebSocket. */
class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.nextId = 1
    this.pending = new Map()
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', reject, { once: true })
    })
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      }
    })
  }
  send(method, params = {}) {
    const id = this.nextId++
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }
  close() { this.ws.close() }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), 'wg-cdp-'))
  let chrome
  let page
  // Hoisted for the finally-block scene restore (runs even when steps throw).
  let originalManual = null
  let overlayPath = ''
  let overlayExistedBefore = false
  try {
    chrome = spawn(CHROME, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profileDir}`,
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1440,900',
      'about:blank',
    ], { stdio: 'ignore' })

    // Wait for the DevTools endpoint.
    let targets
    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
        if (res.ok) break
      } catch { /* not up yet */ }
      await sleep(250)
    }
    if (chrome.exitCode !== null) throw new Error('chrome exited early')

    // Open the GUI page.
    const newRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(BASE)}`, { method: 'PUT' })
    const target = await newRes.json()
    page = new CDP(target.webSocketDebuggerUrl)
    await page.open()

    const evaluate = async (expression) => {
      const result = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(`page evaluate failed: ${JSON.stringify(result.exceptionDetails)}`)
      return result.result.value
    }
    const waitFor = async (expression, timeoutMs = 15000) => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return true
        await sleep(250)
      }
      return false
    }

    // ---- 0. Host ready (GET includes manual; PUT available) ----
    let snapshot
    try {
      const res = await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' })
      snapshot = await res.json()
      report('Host GET /workspace-groups/config returns manual field', res.ok && 'manual' in snapshot, `manual=${JSON.stringify(snapshot.manual)}`)
    } catch (error) {
      report('Host GET /workspace-groups/config reachable', false, String(error))
      return 1
    }
    originalManual = snapshot.manual ?? { categories: [], assignments: {} }
    try {
      overlayPath = join(process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh'), 'workspace-groups.manual.json')
      overlayExistedBefore = await access(overlayPath).then(() => true, () => false)
    } catch { /* non-fatal */ }

    // ---- 1. GUI tree ready ----
    report('GUI 3-level tree renders (.wgRoot + project rows)', await waitFor(`document.querySelectorAll('.wgProjectRow').length > 0`))
    report('Header contains "New group" button', await evaluate(`!!document.querySelector('button[aria-label="New group"]')`))
    report('Group and project row icons are distinguishable (folder vs project glyph)', await evaluate(`(() => {
      const g = document.querySelector('.wgCategoryRow [data-wg-row-icon="group"] svg')?.outerHTML ?? ''
      const p = document.querySelector('.wgProjectRow [data-wg-row-icon="project"] svg')?.outerHTML ?? ''
      return g !== '' && p !== '' && g !== p
    })()`))

    // ---- 2. Create new group ----
    // Pick a group name that doesn't collide with the live environment (the
    // user may already have a "Verify Group" from their own use or a prior run).
    const takenNames = new Set([
      ...(snapshot.categories ?? []).map(c => c.name),
      ...(snapshot.manual?.categories ?? []),
      ...(snapshot.manual?.renamed ? Object.values(snapshot.manual.renamed) : []),
      'Uncategorized', 'Plugins', LEGACY_UNCATEGORIZED_ZH, LEGACY_PLUGINS_ZH,
    ])
    let groupName = 'Verify Group'
    for (let i = 2; takenNames.has(groupName); i++) groupName = `Verify Group ${i}`
    await evaluate(`document.querySelector('button[aria-label="New group"]').click()`)
    report('New group dialog appears', await waitFor(`!!document.querySelector('.wgRenameInput')`))
    await evaluate(`(() => {
      const input = document.querySelector('.wgRenameInput')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(groupName)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })()`)
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Create')
      if (btn) btn.click()
    })()`)
    report('Empty group renders immediately', await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')`))

    // ---- 3. Drag project into group ----
    const wsid = await evaluate(`document.querySelector('.wgProjectRow')?.getAttribute('data-wsid') ?? ''`)
    if (wsid === '') { report('Acquire project row to drag', false); return 1 }
    const dragStart = await evaluate(`(() => {
      const source = document.querySelector('.wgProjectRow[data-wsid="${wsid}"]')
      const target = document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')
      if (!source || !target) return { error: 'missing source/target' }
      const dt = new DataTransfer()
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
      const types = Array.prototype.slice.call(dt.types || [])
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
      target.__wgDt = dt // reuse the same DataTransfer for the drop step
      return { types }
    })()`)
    report('dragstart carries custom MIME type', dragStart.types?.includes('application/x-dsh-workspace-groups') === true, `types=${JSON.stringify(dragStart.types)}`)
    // React commits the drop-highlight on the next render — wait for the class.
    report('dragover highlights target row', await waitFor(`document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')?.classList.contains('wgDropTarget') === true`, 5000))
    const dropped = await evaluate(`(() => {
      const target = document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')
      if (!target?.__wgDt) return false
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: target.__wgDt }))
      return true
    })()`)
    report('drop event dispatched', dropped === true)
    // A workspace sits under a group when the group's section contains its row.
    const movedUnderGroup = `(() => {
      const section = document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')?.parentElement
      return !!section && !!section.querySelector('.wgProjectRow[data-wsid="${wsid}"]')
    })()`
    report('Project moved into new group after drop', await waitFor(movedUnderGroup))

    // ---- 4. Persistence to disk ----
    await sleep(500)
    const afterDrop = await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' }).then(r => r.json())
    const persisted = afterDrop.manual?.assignments?.[wsid] === groupName
    report('PUT persisted: assignments contains dragged entry', persisted)
    await page.send('Page.reload')
    // Assert persistence via the overlay (the Verify Group may render collapsed
    // after refresh, so a DOM row check would be environment-dependent).
    report('Groups and assignments persist after reload (overlay persistence)', await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => d.manual?.assignments?.[${JSON.stringify(wsid)}] === ${JSON.stringify(groupName)})`))

    // ---- 5. Invalid PUT rejected ----
    const bad = await fetch(`${BASE}/workspace-groups/manual`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: [], assignments: { [wsid]: 'Ghost Group' } }),
    })
    report('Invalid PUT (unknown category) returns 400', bad.status === 400, `status=${bad.status}`)

    // ---- 5.5 v0.3: In-group reorder + collapse other group projects during drag ----
    // cat1 = the first VISIBLE group with >=2 held projects (rule categories
    // preferred, manual groups qualify too — the live environment may leave
    // every rule category empty because the user moved their members into a
    // manual group); cat2 = the manual Verify Group created in the v0.2 flow.
    const hiddenSet = new Set(snapshot.manual?.hidden ?? [])
    const ruleKeys = (snapshot.categories ?? []).map(c => c.name).filter(n => !hiddenSet.has(n))
    const cat2 = groupName
    const expandCat = (key) => evaluate(`(() => {
      const row = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(key)}]')
      if (!row) return false
      if (row.getAttribute('aria-expanded') === 'false') row.click()
      return true
    })()`)
    const expandProject = (key) => evaluate(`(() => {
      const section = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(key)}]')?.parentElement
      if (!section) return false
      for (const row of section.querySelectorAll('.wgProjectRow')) {
        if (row.getAttribute('aria-expanded') === 'false') row.click()
      }
      return true
    })()`)
    // Expand every visible group first so project rows render, then pick cat1
    // = the first group (not Verify Group) holding >=2 project rows by DOM count.
    // Wait for the re-render before counting (a click expands async).
    await evaluate(`(() => {
      for (const row of document.querySelectorAll('.wgCategoryRow')) {
        if (row.getAttribute('aria-expanded') !== 'true') row.click()
      }
      return true
    })()`)
    const cat1 = await evaluate(`(() => {
      return new Promise(resolve => {
        let tries = 0
        const tick = () => {
          for (const row of document.querySelectorAll('.wgCategoryRow')) {
            const key = row.getAttribute('data-wg-category')
            if (!key || key === ${JSON.stringify(cat2)}) continue
            const section = row.parentElement
            if (section && section.querySelectorAll('.wgProjectRow').length >= 2) return resolve(key)
            // The config may still be loading after the refresh; keep trying to
            // expand a collapsed group so its rows eventually render.
            if (row.getAttribute('aria-expanded') !== 'true') row.click()
          }
          if (++tries > 60) return resolve(undefined)
          setTimeout(tick, 250)
        }
        tick()
      })
    })()`)
    const cat1IsRule = cat1 !== undefined && ruleKeys.includes(cat1)
    if (cat1 === undefined) {
      const diag = JSON.stringify(await evaluate(`(() => ({
        groups: [...document.querySelectorAll('.wgCategoryRow')].map(r => ({ key: r.getAttribute('data-wg-category'), rows: r.parentElement?.querySelectorAll('.wgProjectRow').length ?? 0 })),
        flat: document.querySelectorAll('.wgProjectRow.wgProjectFlat').length,
      }))()`))
      report('v0.3/0.7 requires >=1 non-empty group (skipping reorder/collapse assertions)', false, `categories=${JSON.stringify(ruleKeys)} diag=${diag}`)
    } else {
      // Expand both working categories so their project rows are visible, then
      // expand every project row (the v0.6 fold/restore assertions need them
      // expanded before the drag starts).
      await expandCat(cat1)
      await expandCat(cat2)
      const rowsVisible = await waitFor(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        return !!s1 && !!s2 && s1.querySelectorAll('.wgProjectRow').length >= 2 && s2.querySelectorAll('.wgProjectRow').length >= 1
      })()`)
      report('Both groups expanded and project rows visible', rowsVisible)
      await expandProject(cat1)
      await expandProject(cat2)
      report('Project rows expanded (sessions visible for fold assertions)', await waitFor(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        const rows1 = s1 ? [...s1.querySelectorAll('.wgProjectRow')] : []
        const rows2 = s2 ? [...s2.querySelectorAll('.wgProjectRow')] : []
        return rows1.length >= 2 && rows1.every(r => r.getAttribute('aria-expanded') === 'true')
          && rows2.length >= 1 && rows2.every(r => r.getAttribute('aria-expanded') === 'true')
      })()`))

      // ---- Reorder prerequisite: drag top-level project into cat2 (in-group reorder needs >=2 members) ----
      // cat1 has only 1 member left and cannot be consumed; top-level project (null assignment) is a safe source.
      const seedTop = await evaluate(`(() => {
        const source = document.querySelector('.wgProjectRow.wgProjectFlat')
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        if (!source || !target) return { error: 'no top-level row or cat2' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
        window.__wgDt = dt
        window.__wgSource = source
        return { wsid: source.getAttribute('data-wsid') }
      })()`)
      await evaluate(`(() => {
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        window.__wgSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('Reorder prerequisite: drag top-level project into verification group (ensure 2 members)', !!seedTop.wsid && await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        return !!s2 && s2.querySelectorAll('.wgProjectRow').length >= 2
      })()`))
      await expandProject(cat2)

      // ---- v0.4: Drag group (before project consumption tests, ensure both group rows exist) ----
      // Bottom half = move after target group
      const groupDown = await evaluate(`(() => {
        const source = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        if (!source || !target) return false
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + rect.height - 1, dataTransfer: dt }))
        window.__wgCatDt = dt
        window.__wgCatSource = source // dragend fires on the dragged source
        return true
      })()`)
      report('Drag group hovering bottom half -> bottom insertion indicator line', groupDown && await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}].wgInsertAfter')`, 5000))
      await evaluate(`(() => {
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        if (!target || !window.__wgCatDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + target.getBoundingClientRect().height - 1, dataTransfer: window.__wgCatDt }))
        window.__wgCatSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('Drag group down -> moved after target group', await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => {
        const o = d.manual?.categoryOrder ?? []
        return o.indexOf(${JSON.stringify(cat2)}) > o.indexOf(${JSON.stringify(cat1)})
      })`))

      // Top half = move before target group
      const groupUp = await evaluate(`(() => {
        const source = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        if (!source || !target) return false
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + 1, dataTransfer: dt }))
        window.__wgCatDt = dt
        window.__wgCatSource = source // dragend fires on the dragged source
        return true
      })()`)
      report('Drag group hovering top half -> top insertion indicator line', groupUp && await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}].wgInsertBefore')`, 5000))
      await evaluate(`(() => {
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        if (!target || !window.__wgCatDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + 1, dataTransfer: window.__wgCatDt }))
        window.__wgCatSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('Drag group up -> moved before target group', await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => {
        const o = d.manual?.categoryOrder ?? []
        return o.indexOf(${JSON.stringify(cat1)}) < o.indexOf(${JSON.stringify(cat2)})
      })`))
      // Let the group-reorder PUT settle before the next drag (manualSaving
      // rejects concurrent writes).
      await sleep(1000)

      // Group drags folded every group — dragend must restore the snapshot
      // automatically (no manual re-expand needed). cat1 has 1 member, cat2
      // has 2 (v0.2 drag-in + top-level seed).
      const autoRestored = await waitFor(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        return !!s1 && !!s2 && s1.querySelectorAll('.wgProjectRow').length >= 1 && s2.querySelectorAll('.wgProjectRow').length >= 2
      })()`)
      report('Group drag automatically restores expansion (dragend restores snapshot)', autoRestored)

      // ---- v0.3: In-group reorder (inside cat2; cat1 has only 1 member left, not enough for reordering) ----
      const reorder = await evaluate(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return { error: 'no section' }
        const rows = s2.querySelectorAll('.wgProjectRow')
        const source = rows[1] // drag the second project
        const target = rows[0] // drop before the first
        if (!source || !target) return { error: 'rows missing' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        window.__wgDt = dt // stash for the drop step (React re-renders may recreate rows)
        window.__wgSource = source // dragend fires on the dragged source
        return { wsid: source.getAttribute('data-wsid'), targetWsid: target.getAttribute('data-wsid') }
      })()`)
      // v0.6: dragging a PROJECT folds every project row (grouped AND
      // top-level) but leaves group rows expanded.
      report('Group rows remain expanded when dragging project', await waitFor(`(() => {
        const r1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        const r2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        return !!r1 && !!r2 && r1.getAttribute('aria-expanded') === 'true' && r2.getAttribute('aria-expanded') === 'true'
      })()`, 5000))
      report('Project rows in same group collapse when dragging project', await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return false
        const rows = [...s2.querySelectorAll('.wgProjectRow')]
        return rows.length >= 2 && rows.every(r => r.getAttribute('aria-expanded') === 'false')
      })()`, 5000))
      report('Project rows in other groups also collapse when dragging project', await waitFor(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        if (!s1) return false
        const rows = [...s1.querySelectorAll('.wgProjectRow')]
        return rows.length >= 1 && rows.every(r => r.getAttribute('aria-expanded') === 'false')
      })()`, 5000))
      await evaluate(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return false
        const target = s2.querySelector('.wgProjectRow')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        window.__wgSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('Project rows restore expansion after dragend (snapshot restored)', await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return false
        const rows = [...s2.querySelectorAll('.wgProjectRow')]
        return rows.length >= 2 && rows.every(r => r.getAttribute('aria-expanded') === 'true')
      })()`, 5000))
      // The user-visible contract: the dragged project now renders first in the group.
      report('In-group drag reorder (second project moved before first)', await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return false
        const first = s2.querySelector('.wgProjectRow')
        return !!first && first.getAttribute('data-wsid') === ${JSON.stringify(reorder.wsid)}
      })()`))

      // ---- v0.4: Drag to bottom half of target row -> insert after target (indicator line visible, inside cat2) ----
      const reorderAfter = await evaluate(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return { error: 'no section' }
        const rows = s2.querySelectorAll('.wgProjectRow')
        const source = rows[0] // currently the first project
        const target = rows[1] // drop on the BOTTOM half of the second
        if (!source || !target) return { error: 'rows missing' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + rect.height - 1, dataTransfer: dt }))
        window.__wgDt = dt // stash for the drop step
        window.__wgSource = source // dragend fires on the dragged source
        return { sourceWsid: source.getAttribute('data-wsid'), targetWsid: target.getAttribute('data-wsid') }
      })()`)
      report('Drag project hovering row bottom half -> bottom insertion indicator line', await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        return !!s2 && !!s2.querySelector('.wgProjectRow.wgInsertAfter')
      })()`, 5000))
      await evaluate(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return false
        const target = s2.querySelector('.wgProjectRow[data-wsid="${reorderAfter.targetWsid}"]')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + target.getBoundingClientRect().height - 1, dataTransfer: window.__wgDt }))
        window.__wgSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('Drag project to bottom half of target row -> inserted after target', await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return false
        const first = s2.querySelector('.wgProjectRow')
        return !!first && first.getAttribute('data-wsid') === ${JSON.stringify(reorderAfter.targetWsid)}
      })()`))

      // ---- v0.4.1: Drag out of group (using cat2 project; cat1's member is reserved for delete flow) ----
      const dragOut = await evaluate(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return { error: 'no section' }
        const source = s2.querySelector('.wgProjectRow')
        if (!source) return { error: 'no project row' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        window.__wgDt = dt // stash for the drop step
        window.__wgSource = source // dragend fires on the dragged source
        return { wsid: source.getAttribute('data-wsid') }
      })()`)
      report('Top-level move-out drop zone visible during drag (top-level row or empty drop zone)', !!dragOut.wsid && await waitFor(`!!(document.querySelector('.wgProjectRow.wgProjectFlat') || document.querySelector('.wgTopLevelEmpty'))`, 5000))
      // Top-level landing is shown with an insertion LINE now: dragging over the
      // empty space below the last top-level row puts an insert-after line on
      // that row (end of the list).
      const overTopArea = await evaluate(`(() => {
        const target = document.querySelector('.wgTopLevelArea')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        return true
      })()`)
      report('Top-level landing indicated by insertion line during drag (below last row)', overTopArea && await waitFor(`!!(document.querySelector('.wgProjectRow.wgProjectFlat.wgInsertAfter') || document.querySelector('.wgTopLevelEmpty'))`, 5000))
      // Let the previous inline reorder PUT settle: moveWorkspaceTo rejects
      // while manualSaving, and the prior PUT's finally clears it a tick after
      // the ordering assertion above passes.
      await sleep(1000)
      const droppedOut = await evaluate(`(() => {
        const target = document.querySelector('.wgTopLevelArea')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        window.__wgSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('Drop on top-level blank area = move out of group (assignments=null persisted)', droppedOut && !!dragOut.wsid && await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => d.manual?.assignments?.[${JSON.stringify(dragOut.wsid)}] === null)`), `wsid=${dragOut.wsid} droppedOut=${droppedOut}`)
      report('Moved-out project appears at top level (no group folder)', !!dragOut.wsid && await waitFor(`!!document.querySelector('.wgProjectRow.wgProjectFlat[data-wsid=${JSON.stringify(dragOut.wsid)}]')`))

      // ---- v0.7: Drag reorder between top-level projects (line indicator) ----
      // Drag the first top-level row before the second; the top-level order is
      // persisted under workspaceOrder[__topLevel__].
      const topReorder = await evaluate(`(() => {
        const flat = document.querySelectorAll('.wgProjectRow.wgProjectFlat')
        if (flat.length < 2) return { error: 'need >=2 top-level rows' }
        const source = flat[1]
        const target = flat[0]
        if (!source || !target) return { error: 'rows missing' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + 1, dataTransfer: dt }))
        window.__wgDt = dt
        window.__wgSource = source
        return { wsid: source.getAttribute('data-wsid'), targetWsid: target.getAttribute('data-wsid') }
      })()`)
      report('Top-level row drag hovering top half -> top insertion line', topReorder.wsid && await waitFor(`!!document.querySelector('.wgProjectRow.wgProjectFlat.wgInsertBefore')`, 5000))
      await evaluate(`(() => {
        const target = document.querySelector('.wgProjectRow.wgProjectFlat[data-wsid="${topReorder.targetWsid}"]')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + 1, dataTransfer: window.__wgDt }))
        window.__wgSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('Top-level project reorder persisted (workspaceOrder[__topLevel__])', topReorder.wsid && await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => {
        const o = d.manual?.workspaceOrder?.['__topLevel__'] ?? []
        const idx = (id) => o.indexOf(id)
        return idx(${JSON.stringify(topReorder.wsid)}) !== -1 && idx(${JSON.stringify(topReorder.wsid)}) < idx(${JSON.stringify(topReorder.targetWsid)})
      })`))

      // ---- v0.7: Verify bottom half insertion -> insert after target (drag to bottom half should be after) ----
      const topAfter = await evaluate(`(() => {
        const flat = document.querySelectorAll('.wgProjectRow.wgProjectFlat')
        if (flat.length < 2) return { error: 'need >=2 top-level rows' }
        const source = flat[0]
        const target = flat[1]
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + rect.height - 1, dataTransfer: dt }))
        window.__wgDt = dt
        window.__wgSource = source
        return { wsid: source.getAttribute('data-wsid'), targetWsid: target.getAttribute('data-wsid') }
      })()`)
      report('Drag to bottom half of top-level row -> bottom insertion line (after indicator)', topAfter.wsid && await waitFor(`!!document.querySelector('.wgProjectRow.wgProjectFlat.wgInsertAfter')`, 5000))
      await evaluate(`(() => {
        const target = document.querySelector('.wgProjectRow.wgProjectFlat[data-wsid="${topAfter.targetWsid}"]')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + target.getBoundingClientRect().height - 1, dataTransfer: window.__wgDt }))
        window.__wgSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('Drag to bottom half of target row -> should insert after target (after)', topAfter.wsid && await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => {
        const o = d.manual?.workspaceOrder?.['__topLevel__'] ?? []
        return o.indexOf(${JSON.stringify(topAfter.wsid)}) > o.indexOf(${JSON.stringify(topAfter.targetWsid)})
      })`))

      // ---- v0.4.1b: Project row menu inside group provides "Move out of group" ----
      // cat2 has 1 project left (v0.2 drag-in + reorder seed - 1 dragged out); after moving out,
      // the manual group becomes empty (still renders), and cat1's member is reserved for the delete flow.
      await expandCat(cat2)
      const menuMoveOut = await evaluate(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        const row = s2?.querySelector('.wgProjectRow')
        if (!row) return false
        row.querySelector('button[aria-label^="Rename "]')?.click()
        return true
      })()`)
      report('Project row menu inside group shows "Move out of group"', menuMoveOut && await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Move out of group')`, 4000))
      // Close the menu (performs the move-out PUT) and let the async write
      // settle before the delete flow (manualSaving guards concurrent writes).
      await evaluate(`(() => {
        const item = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Move out of group')
        if (item) { item.click(); return true }
        return false
      })()`)
      await sleep(1000)

      // ---- v0.3: Group row menu -> Rename -> Delete to top level ----
      const hasMenu = await evaluate(`(() => {
        const row = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        if (!row) return false
        row.querySelector('button[aria-label*="Rename group"]')?.click()
        return !!row.querySelector('button[aria-label*="Rename group"]')
      })()`)
      report('Group row displays "⋯" menu (rename/delete entry)', hasMenu)
      const renamed = `${cat1} (Renamed)`
      const renameFlow = await evaluate(`(() => {
        const item = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Rename group')
        if (!item) return false
        item.click()
        return true
      })()`)
      report('Clicking "Rename group" in menu opens dialog', renameFlow && await waitFor(`!!document.querySelector('.wgRenameInput')`, 4000))
      await evaluate(`(() => {
        const input = document.querySelector('.wgRenameInput')
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(input, ${JSON.stringify(renamed)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })()`)
      await evaluate(`(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Rename' && !b.textContent.includes('group') && !b.textContent.includes('Group'))
        if (btn) btn.click()
      })()`)
      report('Group renders with new name after renaming', await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(renamed)}]')`))
      report('Rename persisted (rule renamed / manual categories)', await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' })
        .then(r => r.json()).then(d => cat1IsRule
          ? d.manual?.renamed?.[cat1] === renamed
          : (d.manual?.categories ?? []).includes(renamed)))

      // Delete the renamed rule group: its projects must go top-level (null).
      // Capture the group's members first (expand the group if collapsed),
      // then drive the delete flow.
      await evaluate(`(() => {
        const row = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(renamed)}]')
        if (row && row.getAttribute('aria-expanded') === 'false') row.click()
        return true
      })()`)
      const memberIds = await evaluate(`(() => {
        const s = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(renamed)}]')?.parentElement
        return s ? [...s.querySelectorAll('.wgProjectRow')].map(r => r.getAttribute('data-wsid')) : []
      })()`)
      await evaluate(`(() => {
        const row = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(renamed)}]')
        row?.querySelector('button[aria-label*="Rename group"]')?.click()
        return true
      })()`)
      await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Delete group')`, 4000)
      await evaluate(`(() => {
        const item = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Delete group')
        if (item) item.click()
        return true
      })()`)
      // The confirm button lives in the delete dialog (also labelled Delete group).
      await waitFor(`(() => {
        const modal = [...document.querySelectorAll('[role="dialog"]')].at(-1)
        return !!modal && [...modal.querySelectorAll('button')].some(b => b.textContent.trim() === 'Delete group')
      })()`, 4000)
      await evaluate(`(() => {
        const modal = [...document.querySelectorAll('[role="dialog"]')].at(-1)
        const btn = modal ? [...modal.querySelectorAll('button')].find(b => b.textContent.trim() === 'Delete group') : undefined
        if (btn) btn.click()
        return true
      })()`)
      report('Group disappears after deletion', await waitFor(`!document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(renamed)}]')`))
      // Every former member must now render as a top-level (ungrouped) row.
      report('Members return to top level after deletion (DOM)', await waitFor(`(() => {
        const ids = new Set([...document.querySelectorAll('.wgProjectRow.wgProjectFlat')].map(r => r.getAttribute('data-wsid')))
        return ${JSON.stringify(memberIds)}.every(id => ids.has(id))
      })()`), `members=${JSON.stringify(memberIds)}`)
      const deleted = await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' }).then(r => r.json())
      const assignments = deleted.manual?.assignments ?? {}
      report('Storage cleanup after deletion (rule hidden / manual categories)', !Object.values(assignments).includes(renamed)
        && !Object.keys(deleted.manual?.workspaceOrder ?? {}).includes(renamed)
        && !(deleted.manual?.categoryOrder ?? []).includes(renamed)
        && (cat1IsRule
          ? deleted.manual?.hidden?.includes(cat1) === true
          : !(deleted.manual?.categories ?? []).includes(cat1)))
      // No Uncategorized bucket exists anywhere in the tree.
      report('No "Uncategorized" bucket exists in tree', await waitFor(`(() => {
        const rows = [...document.querySelectorAll('.wgCategoryRow')]
        return rows.every(r => r.getAttribute('data-wg-category') !== 'Uncategorized' && r.getAttribute('data-wg-category') !== ${JSON.stringify(LEGACY_UNCATEGORIZED_ZH)})
      })()`))
    }
  } catch (error) {
    console.error('Verifier script error:', error)
  } finally {
    // Scene restore must run in finally: no exception/interruption should leave test
    // data in user overlay (previously restore was in try, contaminating real environments on error).
    let restored = false
    if (page) {
      try {
        if (originalManual !== null) {
          await fetch(`${BASE}/workspace-groups/manual`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(originalManual),
          })
          if (!overlayExistedBefore && overlayPath !== '') {
            // The original environment had no overlay file — remove the one we created.
            await unlink(overlayPath).catch(() => {})
          }
          restored = true
        }
      } catch { /* best-effort restore */ }
      if (restored) {
        try {
          const cleaned = await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' }).then(r => r.json())
          const backToOriginal = JSON.stringify(cleaned.manual ?? { categories: [], assignments: {} }) === JSON.stringify(originalManual)
          report('Scene restore: overlay restored to original content', backToOriginal)
        } catch { report('Scene restore: overlay restored to original content', false, 'Restore check request failed') }
      } else {
        report('Scene restore: overlay restored to original content', false, 'Restore request failed')
      }
      page.close()
    }
    if (chrome) chrome.kill('SIGKILL')
    await rm(profileDir, { recursive: true, force: true })
  }

  const failed = results.filter(r => !r.ok)
  console.log(`\nResults: ${results.length - failed.length}/${results.length} passed`)
  return failed.length === 0 ? 0 : 1
}

process.exit(await main())
