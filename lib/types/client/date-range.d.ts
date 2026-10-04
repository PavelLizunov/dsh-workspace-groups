import type { DateRange, RecencyScope, SidebarFilterPreferences } from '../core/types.js';
/** Native date inputs use local calendar days; construct next midnight, never add 24h across DST. */
export declare function calendarDate(value: string): Date | undefined;
export declare function calendarRange(from: string, to: string): DateRange | undefined;
export declare function dateInputValue(timestamp: number): string;
export declare function dateRangeLabel(range: DateRange): string;
export declare function withRecency(filter: SidebarFilterPreferences, recency: RecencyScope): SidebarFilterPreferences;
