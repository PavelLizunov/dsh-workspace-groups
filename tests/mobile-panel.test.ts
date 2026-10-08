/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { activeRightPanel, blurComposer, closePanel, openPanel } from '../packages/mobile-shortcuts/panel-controls.ts'
import { openCamera } from '../packages/mobile-shortcuts/camera-intake.ts'

describe('mobile panel and focus',()=>{
 it('opens and closes only the existing controls',()=>{
  document.body.innerHTML='<button data-sidebar-right-expand></button><div data-sidebar-right-open><button data-sidebar-right-toggle></button></div>'
  const panel=document.querySelector<HTMLElement>('[data-sidebar-right-open]')!
  vi.spyOn(panel,'getBoundingClientRect').mockReturnValue({width:390} as DOMRect)
  const open=vi.spyOn(document.querySelector<HTMLButtonElement>('[data-sidebar-right-expand]')!,'click')
  const close=vi.spyOn(panel.querySelector<HTMLButtonElement>('button')!,'click')
  expect(activeRightPanel(document)).toBe(panel)
  expect(openPanel(document)).toBe(true);expect(open).toHaveBeenCalledOnce()
  expect(closePanel(document)).toBe(true);expect(close).toHaveBeenCalledOnce()
  panel.hidden=true;expect(activeRightPanel(document)).toBeNull()
  expect(closePanel(document)).toBe(false)
  document.body.innerHTML=''
 })
 it('blurs composer focus without stealing unrelated focus',()=>{
  document.body.innerHTML='<div data-composer-card><input id="editor"></div><input id="other">'
  const editor=document.querySelector<HTMLInputElement>('#editor')!,other=document.querySelector<HTMLInputElement>('#other')!
  editor.focus();blurComposer(document);expect(document.activeElement).not.toBe(editor)
  other.focus();blurComposer(document);expect(document.activeElement).toBe(other)
  document.body.innerHTML=''
 })
 it('camera input click does not bubble into the composer focus handler',()=>{
  document.body.innerHTML='<div data-composer-card><input type="file"></div>'
  const card=document.querySelector<HTMLElement>('[data-composer-card]')!,input=card.querySelector('input')!
  const focus=vi.fn();card.addEventListener('click',focus)
  expect(openCamera(input)).toBe(true);expect(focus).not.toHaveBeenCalled()
  input.click();expect(focus).toHaveBeenCalledOnce()
  document.body.innerHTML=''
 })
})
