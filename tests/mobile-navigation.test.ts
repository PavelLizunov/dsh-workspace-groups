/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
// @ts-ignore plain build helper
import { patchGroupedNavigation } from '../packages/mobile-shortcuts/navigation-compat.mjs'

const fixture = `
function match(target){
 if(target.closest('[class*="sessionRow"] button'))return false;
 return target.closest('[class*="newSession"], [class*="sessionRow"], [class*="searchResultRow"]')!==null;
}
function signature(root){
 const selected = root.querySelector('[role="treeitem"][aria-selected="true"]');
 const title = selected?.querySelector('[class*="_title"]');
 return title?.textContent?.trim() ?? null;
}
return {match,signature};`

describe('mobile grouped navigation compatibility',()=>{
 it('recognizes row titles but excludes action buttons and folder rows',()=>{
  const {match}=new Function(patchGroupedNavigation(fixture))()
  document.body.innerHTML='<div class="wgSessionRow"><span class="wgSessionTitle">session</span><button>menu</button></div><div class="wgWorkspaceRow">folder</div>'
  expect(match(document.querySelector('.wgSessionTitle'))).toBe(true)
  expect(match(document.querySelector('button'))).toBe(false)
  expect(match(document.querySelector('.wgWorkspaceRow'))).toBe(false)
  document.body.innerHTML=''
 })
 it('detects different sessions even with identical display titles',()=>{
  const {signature}=new Function(patchGroupedNavigation(fixture))()
  document.body.innerHTML='<div role="treeitem" aria-selected="true" data-session-id="first"><span class="wgSessionTitle">Same title</span></div>'
  expect(signature(document)).toBe('first')
  document.querySelector('[data-session-id]')!.setAttribute('data-session-id','second')
  expect(signature(document)).toBe('second')
  document.body.innerHTML=''
 })
 it('preserves the native row fallback and rejects unsupported bundle shapes',()=>{
  const {signature}=new Function(patchGroupedNavigation(fixture))()
  document.body.innerHTML='<div role="treeitem" aria-selected="true"><span class="abc_title">Native</span></div>'
  expect(signature(document)).toBe('Native')
  expect(()=>patchGroupedNavigation('unrecognized')).toThrow('contract changed')
  document.body.innerHTML=''
 })
})
