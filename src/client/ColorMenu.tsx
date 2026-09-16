/**
 * Color palette menu for groups, workspaces, and sessions.
 */
import { useState } from 'react'
import { IconEditOutline16, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { COLOR_PRESETS, type T } from './row-utils.ts'

export interface ColorMenuProps {
  t: T
  color?: string | null | undefined
  onSelect: (color: string | null) => void
}

/** Flat portal menu: unlike nested submenus, Menu clamps this list to the viewport. */
export function ColorMenu({ t, color, onSelect }: ColorMenuProps) {
  const [open, setOpen] = useState(false)
  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={[
        { id: 'color:none', label: t('color.reset') },
        ...COLOR_PRESETS.map(preset => ({ id: `color:${preset}`, label: t(`color.${preset}` as keyof T) })),
      ]}
      selectedId={`color:${color ?? 'none'}`}
      onSelect={(id) => {
        setOpen(false)
        const selected = id.slice('color:'.length)
        onSelect(selected === 'none' ? null : selected)
      }}
      portal
      compact
      closeOnPointerLeave
      align="end"
      anchor={(
        <button
          type="button"
          className="wgIconButton"
          draggable={false}
          data-wg-color-menu-trigger
          aria-label={t('color.title')}
          title={t('color.title')}
          onClick={(event) => { event.stopPropagation(); setOpen(value => !value) }}
          onKeyDown={(event) => { event.stopPropagation() }}
        >
          <span className="wgCategoryIcon">
            <IconEditOutline16 />
            {color && <span className="wgColorDot" data-color={color} />}
          </span>
        </button>
      )}
    />
  )
}
