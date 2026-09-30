import type { ReactNode } from 'react'
import { folderIconColor } from './row-utils.ts'

/** Direct icon choice uses the same dialog as the row menu, without toggling its tree branch. */
export function FolderIconControl({ kind, color, label, onChoose, children }: {
  kind: 'group' | 'project'
  color?: string | null | undefined
  label: string
  onChoose?: (() => void) | undefined
  children: ReactNode
}) {
  const props = {
    className: 'wgCategoryIcon',
    'data-wg-row-icon': kind,
    'data-color': color ?? undefined,
    style: { color: folderIconColor(color) },
  }
  if (onChoose === undefined) return <span {...props}>{children}</span>
  return (
    <button {...props} type="button" className="wgCategoryIcon wgFolderIconButton" aria-label={label} title={label}
      draggable={false}
      onClick={event => { event.stopPropagation(); onChoose() }}
      onKeyDown={event => { event.stopPropagation() }}
      onDoubleClick={event => { event.stopPropagation() }}
      onDragStart={event => { event.preventDefault(); event.stopPropagation() }}>
      {children}
    </button>
  )
}
