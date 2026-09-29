import { createElement } from 'react'
import { isFolderIconId } from '../core/icons.ts'
import { TABLER_ICONS } from './icons/tabler-data.ts'

/** Trusted bundled artwork only; persisted values are IDs, never markup or URLs. */
export function FolderIcon({ icon }: { icon: string }) {
  if (!isFolderIconId(icon)) return null
  return (
    <svg data-wg-folder-icon={icon} aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {TABLER_ICONS[icon].map(([tag, attributes], index) => createElement(tag, { ...attributes, key: index }))}
    </svg>
  )
}
