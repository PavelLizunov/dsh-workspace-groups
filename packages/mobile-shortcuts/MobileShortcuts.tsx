import { useEffect, useRef, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { findComposerInput, openCamera } from './camera-intake.ts'

type Props = PropsRuntime<'conversation.input.overlay'>

export function MobileShortcuts({ useInput, useSession }: Props) {
  const busy = useInput(state => state.phase !== 'plain')
  const subagent = useSession(state => state.subagent != null)
  const [available, setAvailable] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const card = root.current?.closest('[data-composer-card]')
    if (!card) return
    const update = () => {
      setAvailable(!!findComposerInput(document) && !findComposerInput(document)?.disabled)
      root.current?.style.setProperty('--dsh-mobile-composer-height', `${card.getBoundingClientRect().height}px`)
    }
    const size = new ResizeObserver(update)
    const changes = new MutationObserver(update)
    size.observe(card)
    changes.observe(card, {childList:true,subtree:true,attributes:true,attributeFilter:['disabled']})
    update()
    return () => {size.disconnect();changes.disconnect()}
  }, [])
  const language = typeof navigator === 'undefined' ? 'en' : navigator.language
  const labels = language.startsWith('ru') ? {photo:'Фото',camera:'Сделать фото',panel:'Панель',open:'Открыть правую панель',actions:'Быстрые действия'} : language.startsWith('zh') ? {photo:'拍照',camera:'拍照',panel:'面板',open:'打开右侧面板',actions:'快捷操作'} : {photo:'Photo',camera:'Take photo',panel:'Panel',open:'Open right panel',actions:'Quick actions'}
  return <div ref={root} data-mobile-shortcuts="" aria-label={labels.actions}>
    <button type="button" aria-label={labels.camera} title={labels.camera} disabled={busy || subagent || !available}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => {event.stopPropagation(); openCamera(findComposerInput(document))}}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h4l2-3h4l2 3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.6"/></svg>
      <span>{labels.photo}</span>
    </button>
    <button type="button" aria-label={labels.open} title={labels.open}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation()
        const control = document.querySelector<HTMLButtonElement>('[data-sidebar-right-expand]')
          ?? document.querySelector<HTMLButtonElement>('[data-dsh-toggle-cluster] button')
          ?? document.querySelector<HTMLButtonElement>('[data-sidebar-right-toggle]')
        control?.click()
      }}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M15 4v16" stroke="currentColor" strokeWidth="1.6"/></svg>
      <span>{labels.panel}</span>
    </button>
  </div>
}
