/** @vitest-environment jsdom */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { MobileShortcuts } from '../packages/mobile-shortcuts/MobileShortcuts.tsx'

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

describe('shortcut device gate', () => {
  it('renders no desktop buttons, reacts to touch-phone mode, and cleans listeners', () => {
    let change: (() => void) | undefined
    const remove = vi.fn()
    const mode = {matches:false, addEventListener:vi.fn((_type,fn)=>{change=fn}),removeEventListener:remove}
    const query = vi.fn(()=>mode)
    vi.stubGlobal('matchMedia',query)
    const host = document.createElement('div'); document.body.append(host)
    const root = createRoot(host)
    const props = {useInput:(select:any)=>select({phase:'plain'}),useSession:(select:any)=>select({subagent:null})} as any
    act(()=>root.render(<MobileShortcuts {...props}/>))
    expect(query).toHaveBeenCalledWith('(max-width: 767px) and (pointer: coarse) and (hover: none)')
    expect(host.querySelector('[data-mobile-shortcuts]')).toBeNull()
    act(()=>{mode.matches=true;change?.()})
    expect(host.querySelectorAll('button')).toHaveLength(2)
    act(()=>{mode.matches=false;change?.()})
    expect(host.querySelector('[data-mobile-shortcuts]')).toBeNull()
    act(()=>root.unmount())
    expect(remove).toHaveBeenCalledWith('change',change)
    host.remove();vi.unstubAllGlobals()
  })
})
