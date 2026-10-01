import { useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { FOLDER_ICON_GROUPS, type FolderIconId } from '../core/icons.ts'
import { COLOR_PRESETS, folderIconColor, type T } from './row-utils.ts'
import { FolderIcon } from './FolderIcon.tsx'

export function FolderIconPicker({ open, label, icon, color, busy, error, onSelect, onClose, t }: {
  open: boolean
  label: string
  icon?: FolderIconId | undefined
  color?: string | null | undefined
  busy: boolean
  error: string | null
  onSelect: (icon: FolderIconId | null, color: string | null) => void
  onClose: () => void
  t: T
}) {
  const [draftIcon, setDraftIcon] = useState<FolderIconId | null>(icon ?? null)
  const [draftColor, setDraftColor] = useState<string | null>(color ?? null)
  return (
    <Modal open={open} closeLabel={t('close')} title={`${t('icon.title')}: ${label}`} onClose={() => { if (!busy) onClose() }}
      footer={<>
        <Button variant="outline" disabled={busy} onClick={onClose}>{t('close')}</Button>
        <Button disabled={busy} onClick={() => { onSelect(draftIcon, draftColor) }}>{t('icon.save')}</Button>
      </>}>
      <div className="wgFolderAppearancePreview">
        {draftIcon !== null && <span style={{ color: folderIconColor(draftColor) }}><FolderIcon icon={draftIcon} /></span>}
        <span>{label}</span>
      </div>
      <fieldset className="wgFolderColorPalette" disabled={busy}>
        <legend>{t('color.title')}</legend>
        <div className="wgFolderColorChoices">
          <button type="button" className="wgFolderColorChoice" aria-pressed={draftColor === null} onClick={() => { setDraftColor(null) }}>{t('color.reset')}</button>
          {COLOR_PRESETS.map(preset => (
            <button key={preset} type="button" className="wgFolderColorChoice" aria-pressed={draftColor === preset}
              onClick={() => { setDraftColor(preset) }}>
              <span className="wgFolderColorSwatch" aria-hidden="true" style={{ backgroundColor: folderIconColor(preset) }} />
              {t(`color.${preset}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="wgIconCatalog" aria-label={t('icon.title')}>
        {FOLDER_ICON_GROUPS.map(group => (
          <section className="wgIconSection" key={group.id} aria-label={t(`icon.group.${group.id}`)}>
            <h3 className="wgIconSectionTitle">{t(`icon.group.${group.id}`)}</h3>
            <div className="wgIconGrid">
              {group.icons.map(id => (
                <button key={id} type="button" className="wgIconChoice" disabled={busy} aria-pressed={draftIcon === id}
                  title={t(`icon.${id}`)} aria-label={t(`icon.${id}`)} onClick={() => { setDraftIcon(id) }}>
                  <span style={{ color: folderIconColor(draftColor) }}><FolderIcon icon={id} /></span>
                  <span>{t(`icon.${id}`)}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Button variant="outline" disabled={busy} onClick={() => { setDraftIcon(null) }}>{t('icon.reset')}</Button>
      {error !== null && <div className="wgAddError" role="alert">{error}</div>}
    </Modal>
  )
}
