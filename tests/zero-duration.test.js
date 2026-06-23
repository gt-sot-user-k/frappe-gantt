import { DEFAULT_OPTIONS } from '../src/defaults.js';
import Bar, { ZERO_DURATION_NUB_WIDTH } from '../src/bar.js';
import date_utils from '../src/date_utils.js';

test('zero_duration_editable defaults to true', () => {
    expect(DEFAULT_OPTIONS.zero_duration_editable).toBe(true);
});

function stateCtx({ invalid = false, editable = true } = {}) {
    return {
        invalid,
        gantt: { options: { zero_duration_editable: editable } },
        compute_zero_duration_state: Bar.prototype.compute_zero_duration_state,
    };
}

test('zero logical width + option on => ghost nub', () => {
    const r = stateCtx().compute_zero_duration_state(0);
    expect(r.is_zero_duration).toBe(true);
    expect(r.render_width).toBe(ZERO_DURATION_NUB_WIDTH);
});

test('zero logical width + option off => not a ghost, width stays 0', () => {
    const r = stateCtx({ editable: false }).compute_zero_duration_state(0);
    expect(r.is_zero_duration).toBe(false);
    expect(r.render_width).toBe(0);
});

test('invalid bar is never a ghost', () => {
    const r = stateCtx({ invalid: true }).compute_zero_duration_state(0);
    expect(r.is_zero_duration).toBe(false);
});

test('positive logical width => not a ghost, render width = logical', () => {
    const r = stateCtx().compute_zero_duration_state(90);
    expect(r.is_zero_duration).toBe(false);
    expect(r.render_width).toBe(90);
});

function dateCtx(is_zero_duration, width) {
    return {
        is_zero_duration,
        $bar: { getX: () => 90, getWidth: () => width },
        gantt: {
            gantt_start: new Date(2024, 0, 1),
            config: { column_width: 45, step: 1, unit: 'day' },
        },
        compute_start_end_date: Bar.prototype.compute_start_end_date,
    };
}

test('ghost bar keeps end === start even though the nub has width', () => {
    const { new_start_date, new_end_date } = dateCtx(true, ZERO_DURATION_NUB_WIDTH)
        .compute_start_end_date();
    expect(+new_end_date).toBe(+new_start_date);
});

test('non-ghost bar derives end from the rendered width', () => {
    const { new_start_date, new_end_date } = dateCtx(false, 45).compute_start_end_date();
    const days = Math.round((new_end_date - new_start_date) / 86400000);
    expect(days).toBe(1); // 45px / column_width(45) = 1 day
});
