// Derives the timeline's start/end from the task set and the active view mode.
//
// The visible timeline extends a little before the earliest task and after the
// latest, by the view mode's `padding` (e.g. Day view pads "7d"). With
// `infinitePadding` the pad is doubled so there is room to scroll either way.
import type { Task, ViewMode } from '../core/types';
import dates from '../util/dates';

export interface TimelineBounds {
  start: Date;
  end: Date;
}

/** Earliest `_start` and latest `_end` across the tasks (must be parsed). */
function rawSpan(tasks: Task[]): TimelineBounds | null {
  if (tasks.length === 0) return null;
  let start = tasks[0]._start as Date;
  let end = tasks[0]._end as Date;
  for (const t of tasks) {
    const s = t._start as Date;
    const e = t._end as Date;
    if (s < start) start = s;
    if (e > end) end = e;
  }
  return { start, end };
}

/**
 * Compute padded timeline bounds. Tasks must already have parsed `_start`/`_end`
 * (i.e. come from a TaskStore). Returns `null` for an empty task set so callers
 * can decide on a fallback range.
 */
export function computeTimelineBounds(
  tasks: Task[],
  viewMode: ViewMode,
  opts: { infinitePadding?: boolean } = {},
): TimelineBounds | null {
  const span = rawSpan(tasks);
  if (!span) return null;

  const { duration, scale } = dates.parse_duration(viewMode.padding);
  const pad = opts.infinitePadding ? duration * 2 : duration;

  return {
    start: dates.add(dates.clone(span.start), -pad, scale),
    end: dates.add(dates.clone(span.end), pad, scale),
  };
}
