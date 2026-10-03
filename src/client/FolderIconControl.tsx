import type { ReactNode } from 'react'
import { folderIconColor } from './row-utils.ts'

/** Decorative row icon: tapping it expands the row; editing belongs to the row menu. */
export function FolderIconControl({ kind, color, children }: {
  kind: 'group' | 'project'
  color?: string | null | undefined
  children: ReactNode
}) {
  return (
    <span className="wgCategoryIcon" data-wg-row-icon={kind} data-color={color ?? undefined}
      style={{ color: folderIconColor(color) }} aria-hidden="true">
      {children}
    </span>
  )
}
