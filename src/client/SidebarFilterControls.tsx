import { useState } from 'react'
import { IconChevronDownOutline14, IconClockOutline16, Menu, Modal, Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { FolderIcon } from './FolderIcon.tsx'
import { COLOR_PRESETS, type T } from './row-utils.ts'
import type { SidebarFilter, RecencyScope } from './tree-filter.ts'

import { QUICK_RECENCY_SCOPES } from '../core/types.ts'
import { calendarRange, dateInputValue, dateRangeLabel, withRecency } from './date-range.ts'

const PERIODS: RecencyScope[] = [...QUICK_RECENCY_SCOPES]

function PeriodIcon({ period }: { period: RecencyScope }) {
  if (period === 'all' || period === '1h' || period === '3h' || period === '24h') return <IconClockOutline16 />
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="2.5" y="4" width="15" height="13.5" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M6 2.5v3M14 2.5v3M3 8h14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <text x="10" y="15" textAnchor="middle" fill="currentColor" fontSize="7" fontWeight="600">{period === 'custom' ? '…' : period.replace('d', '')}</text>
  </svg>
}

/** Native Menu owns focus, dismissal and placement; only the choice layout is custom. */
export function SidebarFilterControls({ filter, onChange, t }: {
  filter: SidebarFilter
  onChange: (filter: SidebarFilter) => void
  t: T
}) {
  const [open, setOpen] = useState<'color' | 'period' | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const draft = calendarRange(from, to)
  const periodLabel = filter.recency === 'custom' && filter.dateRange ? dateRangeLabel(filter.dateRange) : t(`filter.recency.${filter.recency}`)
  const openCalendar = () => {
    setOpen(null)
    setFrom(filter.dateRange ? dateInputValue(filter.dateRange.from) : dateInputValue(Date.now()))
    setTo(filter.dateRange ? dateInputValue(filter.dateRange.to - 1) : dateInputValue(Date.now()))
    setCalendarOpen(true)
  }
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
      items={[...PERIODS.map(period => ({ id: period, label: <span data-wg-filter-period data-wg-filter-selected={filter.recency === period}>{t(`filter.recency.${period}`)}</span>, icon: <PeriodIcon period={period} /> })),
        { type: 'separator' as const, id: 'range-separator' },
        { id: 'custom', label: <span data-wg-filter-period data-wg-filter-selected={filter.recency === 'custom'}>{t('filter.recency.custom')}</span>, icon: <PeriodIcon period="custom" /> },
      ]}
      selectedId={filter.recency}
      onSelect={id => { if (id === 'custom') openCalendar(); else { onChange(withRecency(filter, id as RecencyScope)); setOpen(null) } }}
      anchor={<button type="button" className={`wgFilterSelectBtn${filter.recency !== 'all' ? ' wgFilterSelectBtnActive' : ''}`}
        aria-label={`${t('filter.recency')}: ${periodLabel}`} aria-haspopup="menu" aria-expanded={open === 'period'} data-wg-filter-period-trigger
        onClick={() => { setOpen(value => value === 'period' ? null : 'period') }}>
        <PeriodIcon period={filter.recency} /><span className="wgFilterToolLabel" title={periodLabel}>{periodLabel}</span><IconChevronDownOutline14 />
      </button>} />
    <Modal className="wgDateRangeModal" open={calendarOpen} onClose={() => { setCalendarOpen(false) }} title={t('filter.range.title')} closeLabel={t('filter.range.cancel')}
      footer={<><Button type="button" onClick={() => { setCalendarOpen(false) }}>{t('filter.range.cancel')}</Button>
        <Button type="button" variant="primary" disabled={!draft} onClick={() => { if (draft) { onChange({ ...filter, recency: 'custom', dateRange: draft }); setCalendarOpen(false) } }}>{t('filter.range.apply')}</Button></>}>
      <div className="wgDateRangeFields">
        <label>{t('filter.range.from')}<input type="date" min="1970-01-01" max={to || '9999-12-31'} value={from} onChange={event => { setFrom(event.target.value) }} /></label>
        <label>{t('filter.range.to')}<input type="date" min={from || '1970-01-01'} max="9999-12-31" value={to} onChange={event => { setTo(event.target.value) }} /></label>
      </div>
      <p className="wgDateRangeHint">{t('filter.range.hint')}</p>
      {from !== '' && to !== '' && !draft && <p className="wgDateRangeError" role="alert">{t('filter.range.invalid')}</p>}
    </Modal>
  </div>
}
