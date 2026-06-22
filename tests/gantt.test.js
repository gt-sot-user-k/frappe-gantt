import Gantt from '../src/index.js';

// These exercise pure-ish methods via the prototype with a minimal fake
// context, so they don't require a real DOM/render cycle.

test('view_is matches against an array of mode names', () => {
    const ctx = {
        config: { view_mode: { name: 'Day' } },
        view_is: Gantt.prototype.view_is,
    };

    expect(ctx.view_is('Day')).toBe(true);
    expect(ctx.view_is(['Week', 'Day'])).toBe(true);
    expect(ctx.view_is(['Week', 'Month'])).toBe(false);
});

test('getRowHeights returns effective heights keyed by id', () => {
    const ctx = {
        options: { bar_height: 30, padding: 18 },
        tasks: [{ id: 'a', row_height: 100 }, { id: 'b' }],
        getRowHeights: Gantt.prototype.getRowHeights,
    };

    expect(ctx.getRowHeights()).toEqual({ a: 100, b: 48 });
});

test('resetRowHeight clears a custom row height without throwing', () => {
    let rendered = false;
    const task = { id: 'a', _index: 0, row_height: 99 };
    const ctx = {
        tasks: [task],
        get_task(id) {
            return this.tasks.find((t) => t.id === id);
        },
        render() {
            rendered = true;
        },
    };

    Gantt.prototype.resetRowHeight.call(ctx, 'a');

    expect(task.row_height).toBeUndefined();
    expect(rendered).toBe(true);
});

test('setup_row_heights seeds the store from the option, skipping invalid', () => {
    const ctx = { options: { row_heights: { a: 100, b: -5, c: 'x' } } };

    Gantt.prototype.setup_row_heights.call(ctx);

    expect(ctx.row_heights).toEqual({ a: 100 });
});

test('setup_row_heights is idempotent (does not wipe runtime values)', () => {
    const ctx = {
        row_heights: { a: 80 },
        options: { row_heights: { a: 100 } },
    };

    Gantt.prototype.setup_row_heights.call(ctx);

    expect(ctx.row_heights).toEqual({ a: 80 });
});

test('setup_tasks re-applies stored row heights to new task objects', () => {
    const ctx = {
        row_heights: { a: 120 },
        setup_dependencies() {},
    };

    Gantt.prototype.setup_tasks.call(ctx, [
        { id: 'a', start: '2024-01-01', end: '2024-01-02' },
    ]);

    expect(ctx.tasks[0].row_height).toBe(120);
});
