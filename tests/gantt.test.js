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
