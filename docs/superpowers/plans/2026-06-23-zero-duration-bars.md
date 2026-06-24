# Zero-duration Editable Task Bars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render zero-duration tasks (`start === end`) as a dashed, grabbable "ghost" nub that can be extended from either edge or moved, with a two-way live transition between ghost and solid bar.

**Architecture:** A zero-duration bar has *logical width* `0` but renders a fixed-pixel *nub* with a `.bar-zero-duration` dashed style. Date math always uses the logical width (so the nub never leaks into computed dates), while the SVG rect carries the render width. Existing resize handles, body-drag, snapping, and `date_change` events are reused; the ghost↔solid switch is a CSS class toggled live during drag based on whether logical width is `0`. Gated by a new `zero_duration_editable` option (default `true`).

**Tech Stack:** Vanilla JS + SVG, Vite build, Vitest tests, CSS (nested). Runtime options live in `src/defaults.js`; the rendered bar in `src/bar.js`; gesture wiring in `src/index.js`.

## Global Constraints

- Data model unchanged: a zero-duration task is exactly `task._start === task._end`. Never fake a nonzero duration.
- New option name: `zero_duration_editable`, type `boolean`, default `true`.
- Nub width constant: `ZERO_DURATION_NUB_WIDTH = 28` (px), exported from `src/bar.js`.
- CSS class for the ghost: `bar-zero-duration`, applied to the `$bar` `<rect>`.
- Reuse existing events (`date_change`, `${last_action}_end`); add no new events.
- When `zero_duration_editable === false`, behavior is identical to today (0-width invisible rect).
- Run `npm test` (Vitest) for tests; `npm run lint` for ESLint; `npm run build` to typecheck/build.

## File Structure

- `src/defaults.js` — add `zero_duration_editable: true` to `DEFAULT_OPTIONS`.
- `src/core/types.ts` — add `zeroDurationEditable?: boolean` to the `GanttOptions` interface (type surface only; not wired to runtime).
- `src/bar.js` — export `ZERO_DURATION_NUB_WIDTH`; add `compute_zero_duration_state()`; use it in `prepare_values`; add the ghost class in `draw_bar`; make `compute_start_end_date` ghost-aware; handle `width === 0` in `update_bar_position`.
- `src/index.js` — in `bind_bar_events` mousedown, record a ghost's `owidth` as logical `0`.
- `src/styles/gantt.css` — add `.bar-zero-duration` rule.
- `tests/zero-duration.test.js` — new unit tests (option default, render-width decision, date invariant).
- `README.md` — document the option.

---

### Task 1: Add the `zero_duration_editable` option

**Files:**
- Modify: `src/defaults.js` (`DEFAULT_OPTIONS`, near line 172 after `readonly`)
- Modify: `src/core/types.ts:121` (`GanttOptions`, after the `readonly?` line)
- Test: `tests/zero-duration.test.js` (create)

**Interfaces:**
- Produces: `DEFAULT_OPTIONS.zero_duration_editable === true`; merged into `gantt.options` by the existing `setup_options` (`this.options = { ...DEFAULT_OPTIONS, ...options }`).

- [ ] **Step 1: Write the failing test**

Create `tests/zero-duration.test.js`:

```js
import { DEFAULT_OPTIONS } from '../src/defaults.js';

test('zero_duration_editable defaults to true', () => {
    expect(DEFAULT_OPTIONS.zero_duration_editable).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/zero-duration.test.js`
Expected: FAIL — `expected undefined to be true`.

- [ ] **Step 3: Add the default option**

In `src/defaults.js`, inside `DEFAULT_OPTIONS`, add the line immediately after `readonly: false,`:

```js
    readonly: false,
    zero_duration_editable: true,
```

- [ ] **Step 4: Add the TypeScript type**

In `src/core/types.ts`, in the `GanttOptions` interface, add after the `readonly?: boolean | ReadonlyOptions;` line:

```ts
  readonly?: boolean | ReadonlyOptions;
  /** Render zero-duration tasks (start === end) as an editable dashed nub. */
  zeroDurationEditable?: boolean;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/zero-duration.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/defaults.js src/core/types.ts tests/zero-duration.test.js
git commit -m "feat(zero-duration): add zero_duration_editable option (default on)"
```

---

### Task 2: Render-width decision helper + nub constant

**Files:**
- Modify: `src/bar.js` (top of file: add export; add method `compute_zero_duration_state`)
- Test: `tests/zero-duration.test.js`

**Interfaces:**
- Produces: `export const ZERO_DURATION_NUB_WIDTH = 28;`
- Produces: `Bar.prototype.compute_zero_duration_state(logical_width: number) => { is_zero_duration: boolean, render_width: number }`. Reads `this.invalid` and `this.gantt.options.zero_duration_editable`. Returns `is_zero_duration === true` only when `logical_width === 0`, the option is on, and the bar is not invalid; `render_width` is the nub width when zero, else `logical_width`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/zero-duration.test.js`:

```js
import Bar, { ZERO_DURATION_NUB_WIDTH } from '../src/bar.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/zero-duration.test.js`
Expected: FAIL — `ZERO_DURATION_NUB_WIDTH` is undefined and `compute_zero_duration_state` is not a function.

- [ ] **Step 3: Add the constant**

In `src/bar.js`, after the existing `const RESIZE_HANDLE_SIZE = 10.5;` line (near the top), add:

```js
const RESIZE_HANDLE_SIZE = 10.5;

// Visual width of the placeholder "nub" rendered for a zero-duration task so it
// stays visible and grabbable. Purely cosmetic — never used for date math.
export const ZERO_DURATION_NUB_WIDTH = 28;
```

- [ ] **Step 4: Add the helper method**

In `src/bar.js`, add this method to the `Bar` class (place it directly above `prepare_helpers()`):

```js
    /**
     * Decide whether this bar is a zero-duration "ghost" and what width to render.
     * @param {number} logical_width - column_width * duration (0 for zero-duration)
     * @returns {{ is_zero_duration: boolean, render_width: number }}
     */
    compute_zero_duration_state(logical_width) {
        const is_zero_duration =
            logical_width === 0 &&
            !!this.gantt.options.zero_duration_editable &&
            !this.invalid;
        return {
            is_zero_duration,
            render_width: is_zero_duration
                ? ZERO_DURATION_NUB_WIDTH
                : logical_width,
        };
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/zero-duration.test.js`
Expected: PASS (all 5 tests in the file).

- [ ] **Step 6: Commit**

```bash
git add src/bar.js tests/zero-duration.test.js
git commit -m "feat(zero-duration): add nub constant and render-width decision helper"
```

---

### Task 3: Make `compute_start_end_date` ghost-aware

**Files:**
- Modify: `src/bar.js` (`compute_start_end_date`, currently lines ~640-657)
- Test: `tests/zero-duration.test.js`

**Interfaces:**
- Consumes: `this.is_zero_duration` (set by `prepare_values` / `update_bar_position`).
- Produces: `compute_start_end_date()` returns `new_end_date === new_start_date` when `this.is_zero_duration` is truthy, regardless of the rendered rect width.

- [ ] **Step 1: Write the failing tests**

Append to `tests/zero-duration.test.js`:

```js
import date_utils from '../src/date_utils.js';

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
```

- [ ] **Step 2: Run tests to verify the ghost test fails**

Run: `npx vitest run tests/zero-duration.test.js`
Expected: the "ghost bar keeps end === start" test FAILS (end is `start + 28/45` day); the non-ghost test passes.

- [ ] **Step 3: Update `compute_start_end_date`**

In `src/bar.js`, replace the body of `compute_start_end_date` with:

```js
    compute_start_end_date() {
        const bar = this.$bar;
        const x_in_units = bar.getX() / this.gantt.config.column_width;
        let new_start_date = date_utils.add(
            this.gantt.gantt_start,
            x_in_units * this.gantt.config.step,
            this.gantt.config.unit,
        );

        // A zero-duration ghost renders a cosmetic nub; its logical width is 0,
        // so the end date must equal the start date.
        const logical_width = this.is_zero_duration ? 0 : bar.getWidth();
        const width_in_units = logical_width / this.gantt.config.column_width;
        const new_end_date = date_utils.add(
            new_start_date,
            width_in_units * this.gantt.config.step,
            this.gantt.config.unit,
        );

        return { new_start_date, new_end_date };
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/zero-duration.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm test`
Expected: PASS (existing `bar.test.js` and others still green).

- [ ] **Step 6: Commit**

```bash
git add src/bar.js tests/zero-duration.test.js
git commit -m "feat(zero-duration): keep end === start for ghost bars in date math"
```

---

### Task 4: Wire the ghost into rendering (`prepare_values`, `draw_bar`)

**Files:**
- Modify: `src/bar.js` (`prepare_values` near lines 82-83; `draw_bar` near lines 138-155)

**Interfaces:**
- Consumes: `compute_zero_duration_state` (Task 2).
- Produces: after `prepare_values`, `this.is_zero_duration` is set and `this.width` is the render width (nub for ghosts). `draw_bar` adds the `bar-zero-duration` class to `this.$bar` when `this.is_zero_duration`.

- [ ] **Step 1: Update `prepare_values`**

In `src/bar.js`, replace these two lines in `prepare_values`:

```js
        this.corner_radius = this.gantt.options.bar_corner_radius;
        this.width = this.gantt.config.column_width * this.duration; // Draw more on 10% than date
```

with:

```js
        this.corner_radius = this.gantt.options.bar_corner_radius;
        const logical_width = this.gantt.config.column_width * this.duration;
        const { is_zero_duration, render_width } =
            this.compute_zero_duration_state(logical_width);
        this.is_zero_duration = is_zero_duration;
        this.width = render_width;
```

- [ ] **Step 2: Update `draw_bar`**

In `src/bar.js`, in `draw_bar`, after the `if (this.task.color) ...` line and before `animateSVG(...)`, add the ghost class. The block becomes:

```js
        if (this.task.color) this.$bar.style.fill = this.task.color;
        if (this.is_zero_duration) {
            this.$bar.classList.add('bar-zero-duration');
        }
        animateSVG(this.$bar, 'width', 0, this.width);
```

- [ ] **Step 3: Build to confirm no syntax/type errors**

Run: `npm run build`
Expected: build + `tsc` succeed with no errors.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/bar.js
git commit -m "feat(zero-duration): render zero-duration tasks as a dashed nub"
```

---

### Task 5: Wire the ghost into interaction (`update_bar_position`, mousedown)

**Files:**
- Modify: `src/bar.js` (`update_bar_position`, currently lines ~520-562)
- Modify: `src/index.js` (`bind_bar_events` mousedown handler, currently lines ~1529-1535)

**Interfaces:**
- Consumes: `ZERO_DURATION_NUB_WIDTH`, `this.is_zero_duration`.
- Produces: `update_bar_position({ width })` accepts `width === 0` — collapses the bar to a ghost nub (sets `this.is_zero_duration = true`, adds `bar-zero-duration`); `width > 0` expands it to a solid bar (sets `this.is_zero_duration = false`, removes the class). Mousedown records a ghost's `$bar.owidth` as `0` (logical), so resize deltas measure from zero.

- [ ] **Step 1: Update the width branch in `update_bar_position`**

In `src/bar.js`, in `update_bar_position`, replace this block:

```js
        if (width > 0) {
            this.update_attr(bar, 'width', width);
            this.$date_highlight.style.width = width + 'px';
        }
```

with:

```js
        if (width === 0 && this.gantt.options.zero_duration_editable) {
            // Collapsed to zero duration: show the ghost nub, keep end === start.
            this.is_zero_duration = true;
            this.update_attr(bar, 'width', ZERO_DURATION_NUB_WIDTH);
            bar.classList.add('bar-zero-duration');
            this.$date_highlight.style.width = ZERO_DURATION_NUB_WIDTH + 'px';
        } else if (width > 0) {
            // Real duration: solid bar.
            this.is_zero_duration = false;
            this.update_attr(bar, 'width', width);
            bar.classList.remove('bar-zero-duration');
            this.$date_highlight.style.width = width + 'px';
        }
```

- [ ] **Step 2: Record logical owidth for ghosts on mousedown**

In `src/index.js`, in `bind_bar_events`, find the `bars.forEach` block inside the mousedown handler:

```js
                bars.forEach((bar) => {
                    const $bar = bar.$bar;
                    $bar.ox = $bar.getX();
                    $bar.oy = $bar.getY();
                    $bar.owidth = $bar.getWidth();
                    $bar.finaldx = 0;
                });
```

Replace the `owidth` line so a ghost starts from logical zero:

```js
                bars.forEach((bar) => {
                    const $bar = bar.$bar;
                    $bar.ox = $bar.getX();
                    $bar.oy = $bar.getY();
                    // A ghost renders a cosmetic nub; resize deltas measure from
                    // its logical width of 0, not the nub's pixel width.
                    $bar.owidth = bar.is_zero_duration ? 0 : $bar.getWidth();
                    $bar.finaldx = 0;
                });
```

- [ ] **Step 3: Build and run the full suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests PASS. (The date invariant from Task 3 covers the logical-width path; `is_zero_duration` is flipped before `date_changed` runs inside `update_bar_position`.)

- [ ] **Step 4: Manual verification in the dev demo**

Run: `npm run dev`
In `index.html` (or `builder/demo.js`) add a task with identical start and end, e.g. `{ id: 'zd', name: 'Zero', start: '2024-01-10', end: '2024-01-10' }`. Confirm in the browser:
1. The task shows a dashed nub (`.bar-zero-duration`) with both resize handles on hover.
2. Dragging the right handle past one day turns it solid; dragging the left handle earlier also turns it solid with an earlier start.
3. Dragging the body moves it while it stays a dashed nub.
4. Resizing a normal bar down to a single day, then to zero width, turns it back into a dashed nub.
5. Setting `zero_duration_editable: false` restores the old (invisible) behavior.

- [ ] **Step 5: Commit**

```bash
git add src/bar.js src/index.js
git commit -m "feat(zero-duration): extend/move ghosts with two-way live transition"
```

---

### Task 6: Style the ghost (`.bar-zero-duration`)

**Files:**
- Modify: `src/styles/gantt.css` (add a rule after the `& .bar-invalid { ... }` block, ~line 388)

**Interfaces:**
- Consumes: the `bar-zero-duration` class added in Tasks 4-5.
- Produces: a dashed, semi-transparent fill distinct from `.bar` (solid) and `.bar-invalid` (transparent).

- [ ] **Step 1: Add the CSS rule**

In `src/styles/gantt.css`, immediately after the closing `}` of the `& .bar-invalid { ... }` block, add:

```css
        & .bar-zero-duration {
            fill: var(--g-bar-color);
            fill-opacity: 0.35;
            stroke: var(--g-bar-border);
            stroke-width: 1.5;
            stroke-dasharray: 4;
        }
```

- [ ] **Step 2: Build to confirm CSS compiles**

Run: `npm run build`
Expected: build succeeds (PostCSS/Vite process the nested CSS without error).

- [ ] **Step 3: Visual check**

Run: `npm run dev` and confirm the zero-duration nub renders with a dashed outline and translucent fill, clearly distinct from normal and invalid bars.

- [ ] **Step 4: Commit**

```bash
git add src/styles/gantt.css
git commit -m "style(zero-duration): dashed translucent ghost bar"
```

---

### Task 7: Document the option

**Files:**
- Modify: `README.md` (options table, after the `readonly` row at line 83)

**Interfaces:**
- Consumes: nothing. Documentation only.

- [ ] **Step 1: Add the README row**

In `README.md`, add this row immediately after the `| `readonly` | Disables all editing features. | ... |` row:

```markdown
| `zero_duration_editable` | Render zero-duration tasks (`start === end`) as an editable dashed nub that can be extended or moved. | `true`, `false` | `true` |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(zero-duration): document zero_duration_editable option"
```

---

## Self-Review

**Spec coverage:**
- Dashed ghost nub, fixed pixel width → Task 2 (constant), Task 4 (render), Task 6 (style). ✓
- Both edges extend + body move → Task 5 (logical owidth makes existing left/right resize + drag work). ✓
- Two-way live transition → Task 5 (`update_bar_position` width 0 ↔ >0 toggles `is_zero_duration` + class live). ✓
- Global option default ON → Task 1. ✓
- Logical-vs-render width decoupling (dates never use the nub) → Task 3 + Task 5. ✓
- Reuse existing events → no event changes; `date_changed` path unchanged. ✓
- Option OFF = current behavior → Task 1 default, guarded in helper (Task 2) and `update_bar_position` (Task 5). ✓
- `readonly` suppresses handles but keeps the nub visible → unchanged early-returns in `draw_resize_handles`; nub still drawn. ✓
- Styling distinct from invalid → Task 6. ✓
- Tests → Tasks 1-3 (option default, render-width decision, date invariant). ✓
- Docs → Task 7. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows full code. ✓

**Type consistency:** `ZERO_DURATION_NUB_WIDTH` and `compute_zero_duration_state` (returning `{ is_zero_duration, render_width }`) are defined in Task 2 and used identically in Tasks 3-5. The instance flag is `this.is_zero_duration` throughout. The option is `zero_duration_editable` (runtime) / `zeroDurationEditable` (TS surface) consistently. ✓
