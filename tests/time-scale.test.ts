import { describe, it, expect } from 'vitest';
import { TimeScale } from '../src/scale/time-scale';
import dates from '../src/util/dates';

const start = dates.parse('2024-01-01');

describe('TimeScale (Day view, 30px columns)', () => {
  const scale = new TimeScale({ start, step: '1d', columnWidth: 30 });

  it('maps the start date to x=0', () => {
    expect(scale.dateToX(start)).toBe(0);
  });

  it('maps each day to one column width', () => {
    expect(scale.dateToX(dates.parse('2024-01-04'))).toBe(90); // 3 days * 30px
  });

  it('xToDate is the inverse of dateToX', () => {
    const d = dates.parse('2024-01-06');
    const x = scale.dateToX(d);
    expect(dates.to_string(scale.xToDate(x)).slice(0, 10)).toBe('2024-01-06');
  });

  it('snap rounds to the nearest column edge', () => {
    expect(scale.snap(44)).toBe(30); // closer to 30 than 60
    expect(scale.snap(46)).toBe(60);
  });

  it('columnsBetween counts whole columns', () => {
    expect(scale.columnsBetween(start, dates.parse('2024-01-08'))).toBe(7);
  });
});

describe('TimeScale (Hour view, 20px columns)', () => {
  const scale = new TimeScale({ start, step: '1h', columnWidth: 20 });
  it('maps hours to columns', () => {
    const t = dates.add(dates.clone(start), 5, 'hour');
    expect(scale.dateToX(t)).toBe(100); // 5 hours * 20px
  });
});
