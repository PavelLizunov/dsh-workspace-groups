import { createElement } from 'react'
import { isFolderIconId } from '../core/icons.ts'
import { TABLER_ICONS } from './icons/tabler-data.ts'
import { BRAND_ICONS } from './icons/brand-data.ts'

/** Trusted bundled artwork only; persisted values are IDs, never markup or URLs. */
export function FolderIcon({ icon }: { icon: string }) {
  if (!isFolderIconId(icon)) return null
  const brand = icon === 'deepseek'
  const artwork = brand ? BRAND_ICONS.deepseek : TABLER_ICONS[icon]
  return (
    <svg data-wg-folder-icon={icon} aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill={brand ? 'currentColor' : 'none'} stroke={brand ? 'none' : 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {artwork.map(([tag, attributes], index) => createElement(tag, { ...attributes, key: index }))}
    </svg>
  )
}
