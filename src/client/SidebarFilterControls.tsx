import { useState } from 'react'
import { IconChevronDownOutline14, IconClockOutline16, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import { FolderIcon } from './FolderIcon.tsx'
import { COLOR_PRESETS, type T } from './row-utils.ts'
import type { SidebarFilter, RecencyScope } from './tree-filter.ts'

const PERIODS: RecencyScope[] = ['all', '24h', '7d', '30d']

function PeriodIcon({ period }: { period: RecencyScope }) {
  if (period === 'all' || period === '24h') return <IconClockOutline16 />
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="2.5" y="4" width="15" height="13.5" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M6 2.5v3M14 2.5v3M3 8h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <text x="10" y="15" textAnchor="middle" fill="currentColor" fontSize="7" fontWeight="600">{period === '7d' ? '7' : '30'}</text>
  </svg>
}

/** Native Menu owns focus, dismissal and placement; only the choice layout is custom. */
export function SidebarFilterControls({ filter, onChange, t }: {
  filter: SidebarFilter
  onChange: (filter: SidebarFilter) => void
  t: T
}) {
  const [open, setOpen] = useState<'color' | 'period' | null>(null)
  const colorLabel = filter.color === null ? t('filter.color.all') : t(`color.${filter.color}`)
  return <div className="wgFilterTools">
    <Menu open={open === 'color'} onClose={() => { setOpen(null) }} portal compact
      items={[
        { id: 'none', label: <span data-wg-filter-palette data-wg-filter-selected={filter.color === null}>{t('filter.color.all')}</span>, icon: <span className="wgFilterNoColor" aria-hidden="true" /> },
        ...COLOR_PRESETS.map(color => ({ id: color, label: <span data-wg-filter-palette data-wg-filter-selected={filter.color === color}>{t(`color.${color}`)}</span>, icon: <span className="wgFilterColorDot" data-color={color} aria-hidden="true" /> })),
      ]}
      selectedId={filter.color ?? 'none'}
      onSelect={id => { onChange({ ...filter, color: id === 'none' ? null : id as SidebarFilter['color'] }); setOpen(null) }}
      anchor={<button type="button" className={`wgFilterSelectBtn${filter.color !== null ? ' wgFilterSelectBtnActive' : ''}`}
        aria-label={`${t('color.title')}: ${colorLabel}`} aria-haspopup="menu" aria-expanded={open === 'color'} data-wg-filter-color
        onClick={() => { setOpen(value => value === 'color' ? null : 'color') }}>
        {filter.color === null ? <FolderIcon icon="palette" /> : <span className="wgFilterColorDot" data-color={filter.color} aria-hidden="true" />}
        <span className="wgFilterToolLabel">{filter.color === null ? t('color.title') : colorLabel}</span><IconChevronDownOutline14 />
      </button>} />
    <Menu open={open === 'period'} onClose={() => { setOpen(null) }} portal compact
      items={PERIODS.map(period => ({ id: period, label: <span data-wg-filter-period data-wg-filter-selected={filter.recency === period}>{t(`filter.recency.${period}`)}</span>, icon: <PeriodIcon period={period} /> }))}
      selectedId={filter.recency}
      onSelect={id => { onChange({ ...filter, recency: id as RecencyScope }); setOpen(null) }}
      anchor={<button type="button" className={`wgFilterSelectBtn${filter.recency !== 'all' ? ' wgFilterSelectBtnActive' : ''}`}
        aria-label={`${t('filter.recency')}: ${t(`filter.recency.${filter.recency}`)}`} aria-haspopup="menu" aria-expanded={open === 'period'} data-wg-filter-period-trigger
        onClick={() => { setOpen(value => value === 'period' ? null : 'period') }}>
        <PeriodIcon period={filter.recency} /><span className="wgFilterToolLabel">{t(`filter.recency.${filter.recency}`)}</span><IconChevronDownOutline14 />
      </button>} />
  </div>
}
