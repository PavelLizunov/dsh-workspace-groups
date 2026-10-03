import { useState } from 'react'
import { IconFolderClose16, IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { FolderIcon } from './FolderIcon.tsx'
import { folderIconColor } from './row-utils.ts'

export interface ScopeOption {
  id: string
  label: string
  icon?: string | undefined
  color?: string | null | undefined
}

function ScopeIcon({ option }: { option: ScopeOption }) {
  return <span className="wgCategoryIcon" data-wg-scope-icon aria-hidden="true" style={{ color: folderIconColor(option.color) }}>
    {option.icon ? <FolderIcon icon={option.icon} /> : <IconFolderClose16 />}
  </span>
}

/** Reuse the host's portal menu for SVG-labelled, keyboard-accessible single selection. */
export function ScopeFilter({ label, value, options, onChange }: {
  label: string
  value: string
  options: readonly ScopeOption[]
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(option => option.id === value) ?? options[0]!
  // Prefix IDs because an empty string denotes the All option in persisted preferences.
  return <Menu open={open} onClose={() => { setOpen(false) }} portal autoFocus
    className="wgScopeMenu"
    items={options.map(option => ({ id: `scope:${option.id}`, label: <span className="wgScopeLabel" title={option.label}>{option.label}</span>, icon: <ScopeIcon option={option} /> }))}
    selectedId={`scope:${value}`}
    onSelect={id => { setOpen(false); onChange(id.slice('scope:'.length)) }}
    anchor={<button type="button" className={`wgScopeFilter${value !== '' ? ' wgScopeFilterActive' : ''}`}
      aria-label={`${label}: ${selected.label}`} aria-haspopup="menu" aria-expanded={open}
      title={selected.label} onClick={() => { setOpen(current => !current) }}>
      <ScopeIcon option={selected} />
      <span className="wgScopeLabel">{selected.label}</span>
      <IconChevronDownOutline14 />
    </button>} />
}
