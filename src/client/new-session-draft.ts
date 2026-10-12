/** Immediate, filter-independent new-chat intake. Never writes into the old chat. */
export function installNewSessionDraft(ctx: any): () => void {
  const key = 'workspace-groups.new-session-draft.v1'
  let panel: HTMLDivElement | undefined
  let active: { id: string; text: string; workspaceId?: string; cwd?: string; serverId?: string } | undefined
  let pending: Promise<void> | undefined
  let retryAfterConnect = false
  let pointer: { x: number; y: number; target: HTMLButtonElement } | undefined
  let lastTouch = 0
  let disposed = false
  const connection = ctx.get('connection')
  const ru = navigator.language.startsWith('ru')
  const copy = ru ? {
    title: 'Новая сессия', waiting: 'Подключаем отдельную сессию… Можно уже писать.',
    offline: 'Нет соединения. Черновик сохранён здесь; старый чат не изменён.',
    retry: 'Подключить', close: 'Назад', placeholder: 'Сообщение для нового чата…',
  } : {
    title: 'New session', waiting: 'Connecting a separate session… You can already write.',
    offline: 'No connection. This draft is saved here; your old chat is unchanged.',
    retry: 'Connect', close: 'Back', placeholder: 'Message for the new chat…',
  }
  const save = () => { if (active) try { localStorage.setItem(key, JSON.stringify(active)) } catch {} }
  const dismiss = () => { save(); panel?.remove(); panel = undefined }
  const keydown = (event: KeyboardEvent) => {
    if (!panel) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); dismiss(); return }
    if (event.key !== 'Tab') return
    const controls = Array.from(panel.querySelectorAll<HTMLElement>('textarea, button'))
    const first = controls[0]; const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  const buttonFor = (target: EventTarget | null): HTMLButtonElement | undefined => {
    if (!(target instanceof Element) || target.closest('[data-wg-new-draft]')) return
    const button = target.closest<HTMLButtonElement>('button')
    if (!button || button.disabled) return
    const label = button.getAttribute('aria-label') ?? ''
    if (button.hasAttribute('data-wg-new-session') || button.className.includes('newSession')
      || /^(new session|新建会话|новая сессия|новый чат)(\s|$)/i.test(label)) return button
  }
  const status = (text: string) => { const el = panel?.querySelector('[role="status"]'); if (el) el.textContent = text }
  const connect = (): void => {
    if (!active || pending || disposed) return
    if (!navigator.onLine || (connection?.state.getSnapshot() !== undefined && connection.state.getSnapshot() !== 'connected')) {
      status(copy.offline)
      return
    }
    const draft = active
    status(copy.waiting)
    const waitingTimer = window.setTimeout(() => {
      if (panel && active === draft) status(ru ? 'Сервер ещё создаёт сессию. Продолжайте писать: текст сохраняется отдельно.' : 'The server is still creating the session. Keep writing: this draft stays separate.')
    }, 3000)
    // Let the Host allocate a fresh identity; a caller id forces persisted-log probing.
    // Reuse the returned id on a draft-handoff retry, never reuse an old blank chat.
    const creating = draft.serverId ? Promise.resolve(draft.serverId) : ctx.sessions.create({ ...(draft.workspaceId ? { workspaceId: draft.workspaceId } : draft.cwd ? { cwd: draft.cwd } : {}) })
    pending = creating.then((serverId: string) => {
      draft.serverId = serverId; save()
      if (disposed || active !== draft || !panel) return
      const reference = ctx.sessions.retain(draft.serverId, { source: 'mainView' })
      try {
        const scoped = ctx.sessions.scope(draft.serverId)
        const conversation = scoped?.get('conversation')
        if (draft.text && !conversation?.input) throw new Error('Draft input is not ready; press Connect again')
        if (draft.text) conversation.input.for(scoped).setDraft(draft.text)
        ctx.uiWorkspace.openSession(draft.serverId)
        panel.remove(); panel = undefined; active = undefined
        try { localStorage.removeItem(key) } catch {}
        const frame = document.querySelector('[data-mobile-nav="frame"]:not([data-sidebar-collapsed])')
        if (frame && matchMedia('(max-width: 767px)').matches) frame.querySelector<HTMLButtonElement>('.wgMobileDrawerClose, [data-mobile-nav="toggle"]')?.click()
      } finally { reference.release() }
    }).catch((error: unknown) => { if (active === draft) status(copy.offline + ' ' + (error instanceof Error ? error.message : String(error))) }).finally(() => { clearTimeout(waitingTimer); pending = undefined; if (retryAfterConnect) { retryAfterConnect = false; connect() } })
  }
  const show = (button: HTMLButtonElement): void => {
    if (panel) return
    const workspaceId = button.closest('[data-wsid]')?.getAttribute('data-wsid') ?? undefined
    const list = ctx.sessions.list.getSnapshot()
    const current = list.current ?? Object.values(list.byId).find((s: any) => s.retainedBy?.mainView > 0)
    const currentId = typeof current === 'string' ? current : (current as any)?.id
    const workspace = ctx.workspaces.list.getSnapshot().items.find((w: any) => w.workspaceId === workspaceId || (!workspaceId && w.sessionIds.includes(currentId)))
    let saved: typeof active
    try { saved = JSON.parse(localStorage.getItem(key) ?? 'null') ?? undefined } catch {}
    active = saved?.id && typeof saved.text === 'string' ? saved : {
      id: 'session-' + crypto.randomUUID(), text: '',
      ...(workspace ? { workspaceId: workspace.workspaceId } : list.byId[currentId]?.cwd ? { cwd: list.byId[currentId].cwd } : {}),
    }
    save()
    panel = document.createElement('div')
    panel.dataset.wgNewDraft = ''
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', copy.title)
    panel.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:auto;background:var(--dsw-alias-bg-base,Canvas);color:var(--dsw-alias-label-primary,CanvasText);padding:max(20px,env(safe-area-inset-top)) 20px max(20px,env(safe-area-inset-bottom));box-sizing:border-box;display:flex;flex-direction:column;gap:16px;height:100dvh;font:16px system-ui;'
    const title = document.createElement('h2'); title.textContent = copy.title; title.style.margin = '0'
    const notice = document.createElement('div'); notice.setAttribute('role', 'status'); notice.textContent = copy.waiting
    const input = document.createElement('textarea'); input.setAttribute('aria-label', copy.placeholder); input.placeholder = copy.placeholder; input.value = active.text
    input.style.cssText = 'flex:1;min-height:100px;width:100%;box-sizing:border-box;font:inherit;line-height:1.5;padding:12px;border:1px solid var(--dsw-alias-border-l2,#888);border-radius:8px;background:transparent;color:inherit;resize:none;'
    input.addEventListener('input', () => { if (active) { active.text = input.value; save() } })
    const controls = document.createElement('div'); controls.style.cssText = 'display:flex;gap:12px;'
    for (const [label, action] of [[copy.retry, connect], [copy.close, dismiss]] as const) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'min-height:44px;padding:8px 16px;font:inherit;color:inherit;background:transparent;border:1px solid var(--dsw-alias-border-l2,#888);border-radius:8px;'; b.addEventListener('click', action); controls.append(b)
    }
    panel.append(title, notice, input, controls); document.body.append(panel)
    // No focus on mobile: don't summon keyboard as a side effect of opening.
    if (matchMedia('(pointer: fine)').matches) input.focus()
    else { panel.tabIndex = -1; panel.focus({ preventScroll: true }) }
    connect()
  }
  const down = (event: PointerEvent) => { const button = buttonFor(event.target); pointer = button ? { x: event.clientX, y: event.clientY, target: button } : undefined }
  const up = (event: PointerEvent) => {
    const button = buttonFor(event.target)
    if (!button || !pointer || pointer.target !== button || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) { pointer = undefined; return }
    pointer = undefined
    // Handle the completed touch gesture before shell capture can unmount it.
    if (event.pointerType === 'touch' || event.pointerType === 'pen') { event.stopImmediatePropagation(); lastTouch = performance.now(); show(button) }
  }
  const click = (event: MouseEvent) => {
    const button = buttonFor(event.target)
    if (!button) return
    event.preventDefault(); event.stopImmediatePropagation()
    if (performance.now() - lastTouch < 600 && panel) return
    show(button)
  }
  const online = () => { if (!panel) return; if (pending) retryAfterConnect = true; else connect() }
  window.addEventListener('pointerdown', down, true)
  window.addEventListener('pointerup', up, true)
  window.addEventListener('click', click, true)
  window.addEventListener('online', online)
  window.addEventListener('keydown', keydown, true)
  const unsubscribe = connection?.state.subscribe(() => { if (panel && connection.state.getSnapshot() === 'connected') connect() })
  return () => { disposed = true; unsubscribe?.(); dismiss(); window.removeEventListener('pointerdown', down, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('click', click, true); window.removeEventListener('online', online); window.removeEventListener('keydown', keydown, true) }
}
