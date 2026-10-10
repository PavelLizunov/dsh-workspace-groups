/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { createSessionStarter, revealMobileConversation } from '../src/client/new-session.ts'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'

const workspaceId = 'workspace' as WorkspaceId

describe('workspace plus navigation', () => {
  it('opens once while pending and reveals only after native selection', async () => {
    let selected!: () => void
    let finish!: () => void
    const open = vi.fn((_id: WorkspaceId, beforeOpen: () => void) => {
      selected = beforeOpen
      return new Promise<void>(resolve => { finish = resolve })
    })
    const reveal = vi.fn()
    const start = createSessionStarter(open, vi.fn(), vi.fn(), reveal)
    start(workspaceId)
    start(workspaceId)
    expect(open).toHaveBeenCalledTimes(1)
    expect(reveal).not.toHaveBeenCalled()
    selected()
    finish()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(reveal).toHaveBeenCalledTimes(1)
  })

  it('keeps the drawer on failure or superseded navigation', async () => {
    const report = vi.fn()
    const reveal = vi.fn()
    const open = vi.fn().mockRejectedValueOnce(new Error('refused')).mockResolvedValue(undefined)
    const start = createSessionStarter(open, vi.fn(), report, reveal)
    start(workspaceId)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(report).toHaveBeenLastCalledWith('refused')
    start(workspaceId)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(open).toHaveBeenCalledTimes(2)
    expect(reveal).not.toHaveBeenCalled()
  })

  it('uses the shell close control only for an open phone drawer', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    document.body.innerHTML = '<div data-mobile-nav="frame"><button class="wgMobileDrawerClose"></button></div>'
    const close = vi.fn()
    document.querySelector('button')!.addEventListener('click', close)
    revealMobileConversation()
    expect(close).toHaveBeenCalledTimes(1)
    document.querySelector('[data-mobile-nav]')!.setAttribute('data-sidebar-collapsed', '')
    revealMobileConversation()
    expect(close).toHaveBeenCalledTimes(1)
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })
})
