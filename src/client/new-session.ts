import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'

/** Reveal an opened conversation through the existing mobile shell control. */
export function revealMobileConversation(): void {
  const frame = document.querySelector('[data-mobile-nav="frame"]:not([data-sidebar-collapsed])')
  if (frame === null || !window.matchMedia('(max-width: 767px)').matches) return
  const close = frame.querySelector<HTMLButtonElement>('.wgMobileDrawerClose, [data-mobile-nav="toggle"]')
  close?.click()
}

/** Keep one native navigation pending; close only after actual selection. */
export function createSessionStarter(
  openWorkspace: (workspaceId: WorkspaceId, beforeOpen: () => void) => Promise<void>,
  fallback: (workspaceId?: WorkspaceId) => void,
  reportError: (message: string | null) => void,
  reveal: () => void = revealMobileConversation,
): (workspaceId?: WorkspaceId) => void {
  let pending = false
  return (workspaceId) => {
    if (pending) return
    if (workspaceId === undefined) { fallback(); return }
    pending = true
    reportError(null)
    let opened = false
    void openWorkspace(workspaceId, () => { opened = true }).then(() => {
      if (opened) reveal()
    }).catch((reason: unknown) => {
      reportError(reason instanceof Error ? reason.message : String(reason))
    }).finally(() => { pending = false })
  }
}
