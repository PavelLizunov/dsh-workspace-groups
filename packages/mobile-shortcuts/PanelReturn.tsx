import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { activeRightPanel, closePanel } from './panel-controls.ts'

/** Shell-owned so it remains mounted when the right panel hides the conversation. */
export function PanelReturn() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const mode = window.matchMedia('(max-width: 767px) and (pointer: coarse) and (hover: none)')
    const update = () => setVisible(mode.matches && !!activeRightPanel(document))
    const observer = new MutationObserver(update)
    observer.observe(document.body, {childList:true,subtree:true,attributes:true,attributeFilter:['data-sidebar-right-open','hidden','aria-hidden']})
    mode.addEventListener('change',update)
    update()
    return () => {observer.disconnect();mode.removeEventListener('change',update)}
  }, [])
  if (!visible) return null
  const language = navigator.language
  const label = language.startsWith('ru') ? 'Вернуться в чат' : language.startsWith('zh') ? '返回对话' : 'Back to chat'
  return createPortal(<button type="button" data-mobile-panel-return="" aria-label={label}
    onPointerDown={event=>{event.preventDefault();event.stopPropagation()}}
    onMouseDown={event=>{event.preventDefault();event.stopPropagation()}}
    onClick={event=>{event.stopPropagation();closePanel(document)}}>
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true"><path d="m10 5-7 7 7 7M3 12h18" stroke="currentColor" strokeWidth="1.6"/></svg>
    {label}
  </button>, document.body)
}
