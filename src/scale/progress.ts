// Progress math: convert between a task's progress (0..100) and the rendered
// progress-bar width, and derive the *expected* progress from elapsed time.
// Pure logic — consumed by the bar renderer and the interaction controller.

/** Clamp any number into the valid 0..100 progress range (NaN -> 0). */
export function clampProgress(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.min(100, Math.max(0, p));
}

/** Width (px) of the progress fill for a given progress over a bar width. */
export function progressToWidth(progress: number, barWidth: number): number {
  return (clampProgress(progress) / 100) * barWidth;
}

/** Inverse of progressToWidth: the progress implied by a dragged fill width. */
export function widthToProgress(width: number, barWidth: number): number {
  if (barWidth <= 0) return 0;
  return clampProgress((width / barWidth) * 100);
}

/**
 * Expected progress at `at`, as a percent of the start..end span.
 * Before start -> 0, after end -> 100, zero/negative span -> 0.
 */
export function expectedProgress(start: Date, end: Date, at: Date): number {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  const elapsed = at.getTime() - start.getTime();
  return clampProgress((elapsed / total) * 100);
}
