import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { revealMobileConversation } from './new-session.ts'

/** One native create action for shell, workspace and search plus buttons. */
export function installNativeNewSession(ctx: Context): () => void {
  let pending = false
  let disposed = false
  let pointer: { x: number; y: number; moved: boolean } | undefined
  let notice: HTMLElement | undefined
  const buttonFor = (target: EventTarget | null): HTMLButtonElement | null => {
    if (!(target instanceof Element)) return null
    const button = target.closest<HTMLButtonElement>('button')
    if (!button || button.disabled) return null
    return button.hasAttribute('data-wg-new-session') || button.className.includes('newSession')
      || /^(new session|新建会话|новая сессия|новый чат)(\s|$)/i.test(button.getAttribute('aria-label') ?? '') ? button : null
  }
  const down = (event: PointerEvent) => {
    pointer = buttonFor(event.target) ? { x: event.clientX, y: event.clientY, moved: false } : undefined
  }
  const move = (event: PointerEvent) => {
    if (pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) pointer.moved = true
  }
  const click = (event: MouseEvent) => {
    const button = buttonFor(event.target)
    if (!button || event.defaultPrevented || (event.detail !== 0 && pointer?.moved)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (pending) return
    notice?.remove()
    const list = ctx.sessions.list.getSnapshot()
    const current = list.current ?? list.ids.find(id => {
      const summary = list.byId[id] as { retainedBy?: { mainView?: number } } | undefined
      return (summary?.retainedBy?.mainView ?? 0) > 0
    })
    const workspaceId = button.closest('[data-wsid]')?.getAttribute('data-wsid')
    const workspace = ctx.workspaces.list.getSnapshot().items.find(item => workspaceId
      ? item.workspaceId === workspaceId : current !== undefined && item.sessionIds.includes(current))
    const cwd = current === undefined ? undefined : list.byId[current]?.cwd
    pending = true
    button.setAttribute('aria-busy', 'true')
    // No caller identity: the Host must allocate a new chat, never adopt a blank one.
    void ctx.sessions.create(workspace ? { workspaceId: workspace.workspaceId } : cwd ? { cwd } : {}).then(id => {
      if (disposed) return
      ctx.uiWorkspace.openSession(id)
      revealMobileConversation()
    }).catch((error: unknown) => {
      if (disposed) return
      notice = document.createElement('div')
      notice.setAttribute('role', 'alert')
      notice.className = 'wgSearchStatus wgManualError'
      notice.textContent = (navigator.language.startsWith('ru') ? 'Новая сессия: ' : 'New session: ')
        + (error instanceof Error ? error.message : String(error))
      button.insertAdjacentElement('afterend', notice)
    }).finally(() => { pending = false; button.removeAttribute('aria-busy') })
  }
  // Capture only click: keep native pointer/touch gesture guards intact.
  window.addEventListener('pointerdown', down, true)
  window.addEventListener('pointermove', move, true)
  window.addEventListener('click', click, true)
  return () => {
    disposed = true
    notice?.remove()
    window.removeEventListener('pointerdown', down, true)
    window.removeEventListener('pointermove', move, true)
    window.removeEventListener('click', click, true)
  }
}
