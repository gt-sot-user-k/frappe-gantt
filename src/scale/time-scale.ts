// Maps dates to/from x pixel offsets and snaps to column edges.
// One step = one column = `columnWidth` px.
import type { Duration } from '../core/types';
import dates from '../util/dates';

export class TimeScale {
  readonly start: Date;
  readonly columnWidth: number;
  private readonly stepValue: number;
  private readonly stepScale: string; // 'hour' | 'day' | 'month' | 'year' | ...

  constructor(opts: { start: Date; step: Duration; columnWidth: number }) {
    this.start = opts.start;
    this.columnWidth = opts.columnWidth;
    const { duration, scale } = dates.parse_duration(opts.step);
    this.stepValue = duration;
    this.stepScale = scale;
  }

  /** Fractional number of steps from start to date. */
  private stepsTo(date: Date): number {
    return dates.diff(date, this.start, this.stepScale) / this.stepValue;
  }

  dateToX(date: Date): number {
    return this.stepsTo(date) * this.columnWidth;
  }

  xToDate(x: number): Date {
    const steps = x / this.columnWidth;
    return dates.add(dates.clone(this.start), steps * this.stepValue, this.stepScale);
  }

  /** Round an x offset to the nearest column edge. */
  snap(x: number): number {
    return Math.round(x / this.columnWidth) * this.columnWidth;
  }

  columnsBetween(a: Date, b: Date): number {
    return Math.round(dates.diff(b, a, this.stepScale) / this.stepValue);
  }
}
