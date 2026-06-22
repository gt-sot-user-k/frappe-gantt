import Bar from '../src/bar.js';
import date_utils from '../src/date_utils.js';

// Exercises Bar.prepare_expected_progress_values via the prototype with a
// minimal fake gantt context (no DOM). Pins H1: the expected-progress width
// must use config.column_width (the resolved value), not options.column_width
// (which defaults to null).
test('expected progress width uses the resolved column width', () => {
    const two_days_ago = date_utils.add(date_utils.today(), -2, 'day');

    const ctx = {
        duration: 4,
        task: { _start: two_days_ago },
        gantt: {
            options: { column_width: null }, // default — not yet resolved
            config: { column_width: 45, step: 1, unit: 'day' },
        },
        compute_expected_progress: Bar.prototype.compute_expected_progress,
        prepare_expected_progress_values:
            Bar.prototype.prepare_expected_progress_values,
    };

    ctx.prepare_expected_progress_values();

    expect(ctx.expected_progress_width).toBeGreaterThan(0);
});

test('compute_y centers the bar within a tall row', () => {
    const gantt = {
        config: { header_height: 0 },
        options: { bar_height: 30, padding: 18 },
        tasks: [{ id: 'a' }],
        getRowHeights: () => ({ a: 100 }),
    };
    const ctx = {
        gantt,
        task: { id: 'a', _index: 0 },
        compute_y: Bar.prototype.compute_y,
    };

    ctx.compute_y();

    expect(ctx.y).toBe(35); // 0 + (100 - 30) / 2
});

test('compute_y keeps the legacy position for a default-height row', () => {
    const gantt = {
        config: { header_height: 60 },
        options: { bar_height: 30, padding: 18 },
        tasks: [{ id: 'a' }],
        getRowHeights: () => ({ a: 48 }), // default = 30 + 18
    };
    const ctx = {
        gantt,
        task: { id: 'a', _index: 0 },
        compute_y: Bar.prototype.compute_y,
    };

    ctx.compute_y();

    expect(ctx.y).toBe(69); // 60 + (48 - 30)/2 == header_height + padding/2
});
