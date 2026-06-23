// Decides which dates are "ignored" (excluded from progress math and dragging).
//
// Mirrors the `ignore` option: 'weekend', an array of dates/'weekend', or a
// predicate. Pure logic — no DOM — so it is fully unit-testable.
import type { IgnoreConfig } from '../core/types';
import dates from '../util/dates';

export class IgnoreModel {
  private weekend = false;
  private explicit = new Set<string>();
  private predicate?: (d: Date) => boolean;

  constructor(ignore: IgnoreConfig = []) {
    if (typeof ignore === 'function') {
      this.predicate = ignore;
      return;
    }
    const list = ignore === 'weekend' ? ['weekend' as const] : ignore;
    for (const item of list) {
      if (item === 'weekend') this.weekend = true;
      else this.explicit.add(this.key(item));
    }
  }

  private key(d: string | Date): string {
    return dates.to_string(dates.parse(d)).slice(0, 10);
  }

  isIgnored(date: Date): boolean {
    if (this.predicate) return this.predicate(date);
    if (this.weekend) {
      const day = date.getDay();
      if (day === 0 || day === 6) return true;
    }
    return this.explicit.has(dates.to_string(date).slice(0, 10));
  }

  /** Ignored dates in the half-open range [start, end), stepping by day. */
  ignoredBetween(start: Date, end: Date): Date[] {
    const out: Date[] = [];
    let cur = dates.clone(start);
    while (cur < end) {
      if (this.isIgnored(cur)) out.push(dates.clone(cur));
      cur = dates.add(cur, 1, 'day');
    }
    return out;
  }
}
