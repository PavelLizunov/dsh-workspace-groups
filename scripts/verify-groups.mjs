/**
 * CDP 真机验证脚本（dsh-workspace-groups v0.2/v0.3）。
 *
 * 用法：
 *   node scripts/verify-groups.mjs [baseUrl] [cdpPort] [chromeBin]
 *
 * 行为：
 *   - 启动独立 headless Chrome（独立 user-data-dir），打开 baseUrl 的 GUI；
 *   - v0.2：新建分组弹窗 → 空分组渲染 → 拖拽项目进分组 → PUT 落盘 →
 *     刷新持久化 → 非法 PUT 400；
 *   - v0.3：拖拽项目组内排序 + 拖动时其他分组项目收起、规则分类行出现
 *     「⋯」菜单 → 重命名（renamed 落盘）→ 删除（成员回未分类 + hidden 落盘）、
 *     未分类恒为最末段；
 *   - v0.4：拖拽插入位置指示线（上半=插到行前 / 下半=插到行后）：项目
 *     拖到目标行下半 → 插到目标之后；分组向下拖 → 移到目标分组之后、
 *     向上拖 → 移到目标分组之前；
 *   - 现场恢复：还原原 overlay（原无文件则删除），不留测试数据；
 *   - 依赖 host 已重启（PUT /workspace-groups/manual 可用）；
 *   - 以 0/1 退出码供质量门调用。
 */
import { spawn } from 'node:child_process'
import { mkdtemp, rm, unlink, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.argv[2] ?? 'http://127.0.0.1:3080'
const CDP_PORT = Number(process.argv[3] ?? 9333)
const CHROME = process.argv[4] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

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

    // ---- 0. host 面就绪（GET 含 manual；PUT 可用） ----
    let snapshot
    try {
      const res = await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' })
      snapshot = await res.json()
      report('host GET /workspace-groups/config 返回 manual 字段', res.ok && 'manual' in snapshot, `manual=${JSON.stringify(snapshot.manual)}`)
    } catch (error) {
      report('host GET /workspace-groups/config 可访问', false, String(error))
      return 1
    }
    const originalManual = snapshot.manual ?? { categories: [], assignments: {} }
    const overlayPath = join(process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh'), 'workspace-groups.manual.json')
    const overlayExistedBefore = await access(overlayPath).then(() => true, () => false)

    // ---- 1. GUI 树就绪 ----
    report('GUI 三层树渲染（.wgRoot + 项目行）', await waitFor(`document.querySelectorAll('.wgProjectRow').length > 0`))
    report('区头存在「新建分组」按钮', await evaluate(`!!document.querySelector('button[aria-label="新建分组"]')`))

    // ---- 2. 新建分组 ----
    const groupName = '验证分组'
    await evaluate(`document.querySelector('button[aria-label="新建分组"]').click()`)
    report('新建分组弹窗出现', await waitFor(`!!document.querySelector('.wgRenameInput')`))
    await evaluate(`(() => {
      const input = document.querySelector('.wgRenameInput')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(groupName)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })()`)
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '创建')
      if (btn) btn.click()
    })()`)
    report('空分组立即渲染', await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')`))

    // ---- 3. 拖拽项目进分组 ----
    const wsid = await evaluate(`document.querySelector('.wgProjectRow')?.getAttribute('data-wsid') ?? ''`)
    if (wsid === '') { report('取到待拖拽项目行', false); return 1 }
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
    report('dragstart 携带自定义类型', dragStart.types?.includes('application/x-dsh-workspace-groups') === true, `types=${JSON.stringify(dragStart.types)}`)
    // React commits the drop-highlight on the next render — wait for the class.
    report('dragover 目标行高亮', await waitFor(`document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')?.classList.contains('wgDropTarget') === true`, 5000))
    const dropped = await evaluate(`(() => {
      const target = document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')
      if (!target?.__wgDt) return false
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: target.__wgDt }))
      return true
    })()`)
    report('drop 事件派发', dropped === true)
    // A workspace sits under a group when the group's section contains its row.
    const movedUnderGroup = `(() => {
      const section = document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')?.parentElement
      return !!section && !!section.querySelector('.wgProjectRow[data-wsid="${wsid}"]')
    })()`
    report('drop 后项目移入新分组', await waitFor(movedUnderGroup))

    // ---- 4. 落盘 + 持久化 ----
    await sleep(500)
    const afterDrop = await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' }).then(r => r.json())
    const persisted = afterDrop.manual?.assignments?.[wsid] === groupName
    report('PUT 落盘：assignments 包含拖入记录', persisted)
    await page.send('Page.reload')
    report('刷新后分组与归类保留', await waitFor(`(() => {
      const section = document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')?.parentElement
      return !!section && !!section.querySelector('.wgProjectRow[data-wsid="${wsid}"]')
    })()`))

    // ---- 5. 非法 PUT 被拒 ----
    const bad = await fetch(`${BASE}/workspace-groups/manual`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: [], assignments: { [wsid]: '幽灵分组' } }),
    })
    report('非法 PUT（未知分类）返回 400', bad.status === 400, `status=${bad.status}`)

    // ---- 5.5 v0.3：组内排序 + 拖动时其他分组项目收起 ------------------------
    // cat1 = first VISIBLE rule category (hidden ones don't render); cat2 =
    // the manual 验证分组 created in the v0.2 flow (already holds one project).
    const hiddenSet = new Set(snapshot.manual?.hidden ?? [])
    const ruleKeys = (snapshot.categories ?? []).map(c => c.name).filter(n => !hiddenSet.has(n))
    const cat1 = ruleKeys[0]
    const cat2 = groupName
    if (cat1 === undefined) {
      report('v0.3 需至少一个可见规则分类（跳过排序/收起断言）', false, `categories=${JSON.stringify(ruleKeys)}`)
    } else {
      // Expand both rule categories so their project rows are visible.
      const expandCat = (key) => evaluate(`(() => {
        const row = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(key)}]')
        if (!row) return false
        if (row.getAttribute('aria-expanded') === 'false') row.click()
        return true
      })()`)
      await expandCat(cat1)
      await expandCat(cat2)
      const rowsVisible = await waitFor(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        return !!s1 && !!s2 && s1.querySelectorAll('.wgProjectRow').length >= 2 && s2.querySelectorAll('.wgProjectRow').length >= 1
      })()`)
      report('两个规则分类展开且项目行可见', rowsVisible)

      const reorder = await evaluate(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        if (!s1) return { error: 'no section' }
        const rows = s1.querySelectorAll('.wgProjectRow')
        const source = rows[1] // drag the second project
        const target = rows[0] // drop before the first
        if (!source || !target) return { error: 'rows missing' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        window.__wgDt = dt // stash for the drop step (React re-renders may recreate rows)
        return { wsid: source.getAttribute('data-wsid'), targetWsid: target.getAttribute('data-wsid') }
      })()`)
      // React commits the collapse on the next render — wait for the other
      // category's project rows to disappear before dropping.
      report('拖动项目时其他分组项目收起', await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        return !!s2 && s2.querySelectorAll('.wgProjectRow').length === 0
      })()`, 5000))
      await evaluate(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        if (!s1) return false
        const target = s1.querySelector('.wgProjectRow')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        return true
      })()`)
      // The user-visible contract: the dragged project now renders first in the group.
      report('组内拖拽排序（第二个项目移到第一个之前）', await waitFor(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        if (!s1) return false
        const first = s1.querySelector('.wgProjectRow')
        return !!first && first.getAttribute('data-wsid') === ${JSON.stringify(reorder.wsid)}
      })()`))

      // ---- v0.4：拖到目标行下半 → 插到目标之后（指示线可见） ----
      const reorderAfter = await evaluate(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        if (!s1) return { error: 'no section' }
        const rows = s1.querySelectorAll('.wgProjectRow')
        const source = rows[0] // currently the first project
        const target = rows[1] // drop on the BOTTOM half of the second
        if (!source || !target) return { error: 'rows missing' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + rect.height - 1, dataTransfer: dt }))
        window.__wgDt = dt // stash for the drop step
        return { sourceWsid: source.getAttribute('data-wsid'), targetWsid: target.getAttribute('data-wsid') }
      })()`)
      report('拖项目悬停行下半 → 下方插入指示线', await waitFor(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        return !!s1 && !!s1.querySelector('.wgProjectRow.wgInsertAfter')
      })()`, 5000))
      await evaluate(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        if (!s1) return false
        const target = s1.querySelector('.wgProjectRow[data-wsid="${reorderAfter.targetWsid}"]')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + target.getBoundingClientRect().height - 1, dataTransfer: window.__wgDt }))
        return true
      })()`)
      report('项目拖到目标行下半 → 插入到目标之后', await waitFor(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        if (!s1) return false
        const first = s1.querySelector('.wgProjectRow')
        return !!first && first.getAttribute('data-wsid') === ${JSON.stringify(reorderAfter.targetWsid)}
      })()`))

      // ---- v0.4.1：从分组拖出 —— 未分类桶为空时拖拽中也显示为落点 ----
      const uncatBefore = await evaluate(`!!document.querySelector('.wgCategoryRow[data-wg-category="未分类"]')`)
      const dragOut = await evaluate(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        if (!s1) return { error: 'no section' }
        const source = s1.querySelector('.wgProjectRow')
        if (!source) return { error: 'no project row' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        window.__wgDt = dt // stash for the drop step
        return { wsid: source.getAttribute('data-wsid') }
      })()`)
      report('拖拽中未分类桶可见（原为空也显示）', !!dragOut.wsid && await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category="未分类"]')`, 5000),
        `拖拽前未分类桶存在=${uncatBefore}`)
      const droppedOut = await evaluate(`(() => {
        const target = document.querySelector('.wgCategoryRow[data-wg-category="未分类"]')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        return true
      })()`)
      report('拖到未分类 = 从分组拖出（assignments=null 落盘）', droppedOut && !!dragOut.wsid && await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => d.manual?.assignments?.[${JSON.stringify(dragOut.wsid)}] === null)`))
      await evaluate(`(() => {
        const row = document.querySelector('.wgCategoryRow[data-wg-category="未分类"]')
        if (row && row.getAttribute('aria-expanded') === 'false') row.click()
        return true
      })()`)
      report('拖出的项目出现在未分类桶', !!dragOut.wsid && await waitFor(`(() => {
        const s = document.querySelector('.wgCategoryRow[data-wg-category="未分类"]')?.parentElement
        return !!s && !!s.querySelector('.wgProjectRow[data-wsid=${JSON.stringify(dragOut.wsid ?? '')}]')
      })()`))

      // ---- v0.4.1b：规则分类项目行菜单也提供「移到未分类」 ----
      const menuMoveOut = await evaluate(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        const row = s1?.querySelector('.wgProjectRow')
        if (!row) return false
        row.querySelector('button[aria-label^="重命名 "]')?.click()
        return true
      })()`)
      report('规则分类项目行菜单出现', menuMoveOut && await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '移到未分类')`, 4000))
      // Close the menu (performs the move-out PUT) and let the async write
      // settle — the following group-reorder drops are rejected by the
      // manualSaving re-entrancy guard while a save is in flight.
      await evaluate(`(() => {
        const item = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '移到未分类')
        if (item) { item.click(); return true }
        return false
      })()`)
      await sleep(1000)

      // ---- v0.4：分组拖动 — 下半 = 移到目标分组之后 ----
      const groupDown = await evaluate(`(() => {
        const source = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        if (!source || !target) return false
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + rect.height - 1, dataTransfer: dt }))
        window.__wgCatDt = dt
        return true
      })()`)
      report('拖分组悬停目标行下半 → 下方插入指示线', groupDown && await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}].wgInsertAfter')`, 5000))
      await evaluate(`(() => {
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        if (!target || !window.__wgCatDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + target.getBoundingClientRect().height - 1, dataTransfer: window.__wgCatDt }))
        return true
      })()`)
      report('分组向下拖 → 移到目标分组之后', await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => {
        const o = d.manual?.categoryOrder ?? []
        return o.indexOf(${JSON.stringify(cat2)}) > o.indexOf(${JSON.stringify(cat1)})
      })`))

      // ---- v0.4：分组拖动 — 上半 = 移到目标分组之前 ----
      const groupUp = await evaluate(`(() => {
        const source = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        if (!source || !target) return false
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + 1, dataTransfer: dt }))
        window.__wgCatDt = dt
        return true
      })()`)
      report('拖分组悬停目标行上半 → 上方插入指示线', groupUp && await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}].wgInsertBefore')`, 5000))
      await evaluate(`(() => {
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        if (!target || !window.__wgCatDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + 1, dataTransfer: window.__wgCatDt }))
        return true
      })()`)
      report('分组向上拖 → 移到目标分组之前', await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => {
        const o = d.manual?.categoryOrder ?? []
        return o.indexOf(${JSON.stringify(cat1)}) < o.indexOf(${JSON.stringify(cat2)})
      })`))

      // ---- v0.3：规则分类行出现菜单 → 重命名 → 删除回未分类 ------------------
      const hasMenu = await evaluate(`(() => {
        const row = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        if (!row) return false
        row.querySelector('button[aria-label*="重命名分组"]')?.click()
        return !!row.querySelector('button[aria-label*="重命名分组"]')
      })()`)
      report('规则分类行出现「⋯」菜单（重命名/删除入口）', hasMenu)
      const renamed = `${cat1}·改`
      const renameFlow = await evaluate(`(() => {
        const item = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '重命名分组')
        if (!item) return false
        item.click()
        return true
      })()`)
      report('菜单点击「重命名分组」打开弹窗', renameFlow && await waitFor(`!!document.querySelector('.wgRenameInput')`, 4000))
      await evaluate(`(() => {
        const input = document.querySelector('.wgRenameInput')
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(input, ${JSON.stringify(renamed)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })()`)
      await evaluate(`(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '重命名' && !b.textContent.includes('分组'))
        if (btn) btn.click()
      })()`)
      report('重命名规则分类后以新名渲染', await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(renamed)}]')`))
      report('renamed 落盘（原规则名 → 新名）', await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' })
        .then(r => r.json()).then(d => d.manual?.renamed?.[cat1] === renamed))

      // Delete the renamed rule group: its projects must go to 未分类 (null).
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
        row?.querySelector('button[aria-label*="重命名分组"]')?.click()
        return true
      })()`)
      await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '删除分组')`, 4000)
      await evaluate(`(() => {
        const item = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '删除分组')
        if (item) item.click()
        return true
      })()`)
      // The confirm button lives in the delete dialog (also labelled 删除分组).
      await waitFor(`(() => {
        const modal = [...document.querySelectorAll('[role="dialog"]')].at(-1)
        return !!modal && [...modal.querySelectorAll('button')].some(b => b.textContent.trim() === '删除分组')
      })()`, 4000)
      await evaluate(`(() => {
        const modal = [...document.querySelectorAll('[role="dialog"]')].at(-1)
        const btn = modal ? [...modal.querySelectorAll('button')].find(b => b.textContent.trim() === '删除分组') : undefined
        if (btn) btn.click()
        return true
      })()`)
      report('删除分组后分组消失', await waitFor(`!document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(renamed)}]')`))
      // The uncategorized bucket first appears COLLAPSED — expand it before
      // asserting its members (data is correct; rows render on expand).
      await evaluate(`(() => {
        const row = document.querySelector('.wgCategoryRow[data-wg-category="未分类"]')
        if (row && row.getAttribute('aria-expanded') === 'false') row.click()
        return true
      })()`)
      // Every former member must now render inside the 未分类 section (bottom).
      report('删除后成员回未分类（DOM）', await waitFor(`(() => {
        const s = document.querySelector('.wgCategoryRow[data-wg-category="未分类"]')?.parentElement
        if (!s) return false
        const ids = new Set([...s.querySelectorAll('.wgProjectRow')].map(r => r.getAttribute('data-wsid')))
        return ${JSON.stringify(memberIds)}.every(id => ids.has(id))
      })()`), `members=${JSON.stringify(memberIds)}`)
      const deleted = await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' }).then(r => r.json())
      const assignments = deleted.manual?.assignments ?? {}
      report('删除后 hidden 落盘且引用清理', deleted.manual?.hidden?.includes(cat1) === true
        && !Object.values(assignments).includes(renamed)
        && !Object.keys(deleted.manual?.workspaceOrder ?? {}).includes(renamed)
        && !(deleted.manual?.categoryOrder ?? []).includes(renamed))
      report('未分类恒为最末段', await waitFor(`(() => {
        const rows = document.querySelectorAll('.wgCategoryRow')
        return rows.length > 0 && rows[rows.length - 1].getAttribute('data-wg-category') === ${JSON.stringify('未分类')}
      })()`))
    }

    // ---- 6. 现场恢复 ----
    await fetch(`${BASE}/workspace-groups/manual`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(originalManual),
    })
    if (!overlayExistedBefore) {
      // The original environment had no overlay file — remove the one we created.
      await unlink(overlayPath).catch(() => {})
    }
    await page.send('Page.reload')
    await waitFor(`!!document.querySelector('.wgRoot')`, 8000)
    const cleaned = await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' }).then(r => r.json())
    const backToOriginal = JSON.stringify(cleaned.manual ?? { categories: [], assignments: {} }) === JSON.stringify(originalManual)
    report('现场恢复：overlay 还原为原始内容', backToOriginal)
  } catch (error) {
    console.error('验证脚本异常:', error)
  } finally {
    if (page) page.close()
    if (chrome) chrome.kill('SIGKILL')
    await rm(profileDir, { recursive: true, force: true })
  }

  const failed = results.filter(r => !r.ok)
  console.log(`\n结果: ${results.length - failed.length}/${results.length} 通过`)
  return failed.length === 0 ? 0 : 1
}

process.exit(await main())
