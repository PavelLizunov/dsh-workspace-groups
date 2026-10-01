import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { FOLDER_ICON_GROUPS, type FolderIconId } from '../core/icons.ts'
import type { T } from './row-utils.ts'
import { FolderIcon } from './FolderIcon.tsx'

export function FolderIconPicker({ open, label, icon, busy, error, onSelect, onClose, t }: {
  open: boolean
  label: string
  icon?: FolderIconId | undefined
  busy: boolean
  error: string | null
  onSelect: (icon: FolderIconId | null) => void
  onClose: () => void
  t: T
}) {
  return (
    <Modal open={open} closeLabel={t('close')} title={`${t('icon.title')}: ${label}`} onClose={() => { if (!busy) onClose() }}
      footer={<Button variant="outline" disabled={busy} onClick={onClose}>{t('close')}</Button>}>
      <div className="wgIconCatalog" aria-label={t('icon.title')}>
        {FOLDER_ICON_GROUPS.map(group => (
          <section className="wgIconSection" key={group.id} aria-label={t(`icon.group.${group.id}`)}>
            <h3 className="wgIconSectionTitle">{t(`icon.group.${group.id}`)}</h3>
            <div className="wgIconGrid">
              {group.icons.map(id => (
                <button key={id} type="button" className="wgIconChoice" disabled={busy} aria-pressed={icon === id}
                  title={t(`icon.${id}`)} aria-label={t(`icon.${id}`)} onClick={() => { onSelect(id) }}>
                  <FolderIcon icon={id} />
                  <span>{t(`icon.${id}`)}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Button variant="outline" disabled={busy} onClick={() => { onSelect(null) }}>{t('icon.reset')}</Button>
      {error !== null && <div className="wgAddError" role="alert">{error}</div>}
    </Modal>
  )
}
