// Typed facade over the existing, battle-tested date utilities.
//
// The implementation in `../date_utils` is covered by the legacy test suite
// (tests/date_utils.test.js). Rather than risk a hand-retype of ~350 lines, we
// reuse it behind a strict TypeScript interface. A full verbatim TS port can
// happen when the monolith is removed (migration stage 5).
import date_utils from '../date_utils';
import type { DateInput } from '../core/types';

export interface DateUtils {
  /** Parse "7d" / "6h" / "1m" into its numeric value and scale name. */
  parse_duration(duration: string): { duration: number; scale: string };
  /** Parse a date string or Date into a Date. */
  parse(date: DateInput, date_separator?: string, time_separator?: RegExp): Date;
  /** Format a Date as "YYYY-MM-DD" (or with time). */
  to_string(date: Date, with_time?: boolean): string;
  /** Format a Date with tokens (YYYY, MM, DD, D, HH, mm, ss, SSS, MMMM, MMM). */
  format(date: Date, date_format?: string, lang?: string): string;
  /** Difference between two dates in the given scale (default "day"). */
  diff(date_a: Date, date_b: Date, scale?: string): number;
  /** Today at 00:00:00.000. */
  today(): Date;
  /** Current date/time. */
  now(): Date;
  /** Add `qty` units of `scale` to `date` (returns a new Date). */
  add(date: Date, qty: number, scale: string): Date;
  /** Start of the given period (year/month/day/...). */
  start_of(date: Date, scale: string): Date;
  /** Deep clone a Date. */
  clone(date: Date): Date;
  /** [year, monthIndex, day, hour, minute, second, ms]. */
  get_date_values(date: Date): number[];
  /** Convert a duration string to a count of another scale. */
  convert_scales(period: string, to_scale: string): number;
  get_days_in_month(date: Date): number;
  get_days_in_year(date: Date): number;
}

const dates = date_utils as unknown as DateUtils;
export default dates;
