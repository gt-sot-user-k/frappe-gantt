// Generates the ordered column dates for the timeline header/grid.
//
// Walks from `start` to `end` (inclusive) by the view-mode `step`. Pure logic —
// the header and grid renderers consume this list to place columns and ticks.
import type { Duration } from '../core/types';
import dates from '../util/dates';

export function generateDateColumns(start: Date, end: Date, step: Duration): Date[] {
  const { duration, scale } = dates.parse_duration(step);
  if (duration <= 0) throw new Error(`[gantt] step must be positive: "${step}"`);

  const columns: Date[] = [];
  let cur = dates.clone(start);
  while (cur <= end) {
    columns.push(dates.clone(cur));
    cur = dates.add(cur, duration, scale);
  }
  return columns;
}
