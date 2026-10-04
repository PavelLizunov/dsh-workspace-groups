import { describe, expect, it } from 'vitest'
import { calendarDate, calendarRange, dateInputValue, withRecency } from '../src/client/date-range.ts'
import { DEFAULT_SIDEBAR_FILTER, isSidebarFilterPreferences, parseSidebarFilterPreferences } from '../src/core/types.ts'

describe('calendar range and persisted validation', () => {
  it('includes entire final day using next calendar midnight', () => {
    const range = calendarRange('2026-10-01', '2026-10-04')!
    expect(range.from).toBe(new Date(2026, 9, 1).getTime())
    expect(range.to).toBe(new Date(2026, 9, 5).getTime())
    expect(dateInputValue(range.to - 1)).toBe('2026-10-04')
  })
  it('accepts same day and valid leap day, rejects invalid/reversed/empty dates', () => {
    expect(calendarRange('2024-02-29', '2024-02-29')).toBeDefined()
    for (const value of ['', '2026-02-29', '2026-02-30', '2026-13-01', '1969-01-01', '2026-1-01']) expect(calendarDate(value)).toBeUndefined()
    expect(calendarRange('2026-10-05', '2026-10-04')).toBeUndefined()
  })
  it('uses local calendar arithmetic across DST', () => {
    const old = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      const spring = calendarRange('2026-03-08', '2026-03-08')!
      const fall = calendarRange('2026-11-01', '2026-11-01')!
      expect(spring.to - spring.from).toBe(23 * 3600000)
      expect(fall.to - fall.from).toBe(25 * 3600000)
    } finally { if (old === undefined) delete process.env.TZ;else process.env.TZ = old }
  })
  it('preserves legacy filters and accepts valid extended/custom settings', () => {
    expect(parseSidebarFilterPreferences({ status: 'all', recency: '24h', color: null })).toEqual({ ...DEFAULT_SIDEBAR_FILTER, recency: '24h' })
    for(const recency of ['1h','3h','90d'])expect(isSidebarFilterPreferences({...DEFAULT_SIDEBAR_FILTER,recency})).toBe(true)
    const custom = {...DEFAULT_SIDEBAR_FILTER,recency:'custom',dateRange:{from:1,to:100}}
    expect(parseSidebarFilterPreferences(custom)).toEqual(custom)
    for(const dateRange of [undefined,{from:100,to:1},{from:1,to:1},{from:NaN,to:100},{from:1.5,to:100},{from:1,to:100,extra:true}])expect(isSidebarFilterPreferences({...custom,dateRange})).toBe(false)
    expect(withRecency(custom as never,'7d')).toEqual({...DEFAULT_SIDEBAR_FILTER,recency:'7d'})
    expect(parseSidebarFilterPreferences({...DEFAULT_SIDEBAR_FILTER,dateRange:{from:1,to:100}})).toEqual(DEFAULT_SIDEBAR_FILTER)
  })
})
