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

// ─── update_bar_position two-way transition tests ────────────────────────────

function barPosCtx({ zero_duration_editable = true } = {}) {
    const classes = new Set();
    const bar = {
        _w: 0,
        setAttribute(attr, v) { if (attr === 'width') this._w = +v; },
        getWidth() { return this._w; },
        classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    };
    return {
        $bar: bar,
        _classes: classes,
        task: {},
        $date_highlight: { style: {} },
        gantt: { options: { zero_duration_editable, show_expected_progress: false } },
        update_attr: Bar.prototype.update_attr,
        update_bar_position: Bar.prototype.update_bar_position,
        // downstream no-ops:
        update_label_position() {},
        update_handle_position() {},
        date_changed() {},
        compute_duration() {},
        update_progressbar_position() {},
        update_arrow_position() {},
        update_expected_progressbar_position() {},
    };
}

test('update_bar_position: width=0 + option on => ghost nub applied', () => {
    const ctx = barPosCtx({ zero_duration_editable: true });
    ctx.update_bar_position({ width: 0 });
    expect(ctx.is_zero_duration).toBe(true);
    expect(ctx._classes.has('bar-zero-duration')).toBe(true);
    expect(ctx.$bar.getWidth()).toBe(ZERO_DURATION_NUB_WIDTH);
    expect(ctx.$date_highlight.style.width).toBe(ZERO_DURATION_NUB_WIDTH + 'px');
});

test('update_bar_position: width>0 after ghost => toggles back to real bar', () => {
    const ctx = barPosCtx({ zero_duration_editable: true });
    // First seed the ghost state
    ctx.update_bar_position({ width: 0 });
    expect(ctx._classes.has('bar-zero-duration')).toBe(true);
    // Then transition to a real width
    ctx.update_bar_position({ width: 90 });
    expect(ctx.is_zero_duration).toBe(false);
    expect(ctx._classes.has('bar-zero-duration')).toBe(false);
    expect(ctx.$bar.getWidth()).toBe(90);
    expect(ctx.$date_highlight.style.width).toBe('90px');
});

test('update_bar_position: width=0 + option off => no-op (no ghost)', () => {
    const ctx = barPosCtx({ zero_duration_editable: false });
    ctx.update_bar_position({ width: 0 });
    expect(ctx.is_zero_duration).toBeFalsy();
    expect(ctx._classes.has('bar-zero-duration')).toBe(false);
    expect(ctx.$bar.getWidth()).toBe(0); // rect width unchanged
});

// ─── calculate_progress_width ghost guard tests ───────────────────────────────

test('calculate_progress_width: ghost short-circuits to 0', () => {
    const ctx = {
        is_zero_duration: true,
        calculate_progress_width: Bar.prototype.calculate_progress_width,
    };
    const result = ctx.calculate_progress_width();
    expect(result).toBe(0);
    expect(ctx.progress_width).toBe(0);
});

test('calculate_progress_width: non-ghost computes positive width (50% of 90px = 45)', () => {
    const ctx = {
        is_zero_duration: false,
        $bar: { getWidth: () => 90 },
        x: 0,
        task: { progress: 50 },
        gantt: {
            config: { column_width: 45, ignored_positions: [] },
            get_ignored_region: () => [],
        },
        calculate_progress_width: Bar.prototype.calculate_progress_width,
    };
    const result = ctx.calculate_progress_width();
    expect(result).toBe(45);
    expect(ctx.progress_width).toBe(45);
});
