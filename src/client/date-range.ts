import type { DateRange, RecencyScope, SidebarFilterPreferences } from '../core/types.ts'

/** Native date inputs use local calendar days; construct next midnight, never add 24h across DST. */
export function calendarDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  if (year < 1970 || year > 9999) return undefined
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined
}
export function calendarRange(from: string, to: string): DateRange | undefined {
  const start = calendarDate(from), end = calendarDate(to)
  if (!start || !end || start > end) return undefined
  const next = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
  return { from: start.getTime(), to: next.getTime() }
}
export function dateInputValue(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function dateRangeLabel(range: DateRange): string {
  const format = (value: number) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return `${format(range.from)} – ${format(range.to - 1)}`
}
export function withRecency(filter: SidebarFilterPreferences, recency: RecencyScope): SidebarFilterPreferences {
  const { dateRange: _range, ...rest } = filter
  return { ...rest, recency }
}
