# Zero-duration task bars — design

**Date:** 2026-06-23
**Branch:** feature/row-height-sync
**Status:** Approved (pending spec review)

## Problem

A task whose `start === end` has duration `0`. In `Bar.prepare_values`:

```js
this.width = this.gantt.config.column_width * this.duration; // duration === 0 -> width 0
```

A 0-width `<rect>` is invisible and has no hit area, so a zero-duration task:

- cannot be seen,
- cannot be clicked (no popup),
- cannot be grabbed to resize or move.

There is no milestone / zero-duration handling anywhere in the codebase today. We want
zero-duration tasks to be **visible and editable**: a user should be able to grab one and
extend it into a real duration, or move it, conveniently.

## Goals

- Render a zero-duration task as a **dashed "ghost" nub** — a fixed small pixel-width
  placeholder — that is clearly distinct from a normal bar.
- Allow the ghost to be **extended from either edge** (left handle = earlier start,
  right handle = later end) and **moved** by dragging its body.
- Transition **both ways, live during a drag**: extending a ghost past one snap unit turns
  it into a normal solid bar; shrinking a normal bar down to zero duration turns it back
  into a ghost.
- Gate the behavior behind a **global config option, default ON**.
- Reuse existing gesture, snapping, and event plumbing; emit the same `date_change` /
  `*_end` events as normal edits.

## Non-goals

- No per-bar "activation" gesture (the chosen activation model is a global option that is
  always on when enabled — no click-to-activate state).
- No classic diamond milestone marker (explicitly rejected in favor of the dashed ghost).
- No data-model change: a zero-duration task is just `start === end`; we do **not** fake a
  tiny nonzero duration.

## Chosen approach — decouple "logical width" from "render width"

A zero-duration bar means **logical width `0`** (`task._start === task._end`). Instead of
rendering a 0px (invisible) rect, render a fixed small **nub** with a dashed
`.bar-zero-duration` style. Date math keeps using the *logical* width (`0`); the rect
carries the *render* width (the nub). All existing handles, body-drag, snapping, and events
are reused. The ghost ↔ solid switch is a CSS class toggled live during a drag based on
whether logical width is `0`.

### Alternatives rejected

- **Separate ghost overlay element** — keep `$bar` at 0 width (invisible) and draw an extra
  dashed `$ghost` rect + its own handle, swapping on extend. Rejected: duplicate hit-areas
  and handle wiring, and two-way live transitions require swapping elements mid-drag — more
  code and more state to keep in sync.
- **Minimum-width clamp (fake tiny duration)** — rejected: corrupts the data model
  (`end ≠ start`) and breaks zero-duration semantics; dates would be wrong.

## Components & changes

### 1. Config (`src/defaults.js`, `src/core/types.ts`, `src/core/config.ts`)

New boolean option **`zero_duration_editable`**, **default `true`**.

- `true`: zero-duration tasks render as the dashed grabbable nub and are editable.
- `false`: current behavior (effectively invisible 0-width rect) — backward-compatible
  escape hatch.

Mirror the option in the TypeScript options type and the README/options docs.

### 2. Rendering (`src/bar.js`)

- Add a constant `ZERO_DURATION_NUB_WIDTH` sized to fit both resize handles
  (~28px — roughly `2.5 * RESIZE_HANDLE_SIZE`).
- In `prepare_values`: compute the logical width as today; set
  `this.is_zero_duration = (logical_width === 0) && this.gantt.options.zero_duration_editable`.
  Track the logical width explicitly (e.g. `this.logical_width`).
- In `draw_bar`: render with `render_width = this.is_zero_duration ? ZERO_DURATION_NUB_WIDTH
  : this.logical_width`. Add class `bar-zero-duration` to `$bar` when `is_zero_duration`.
- Resize handles (`draw_resize_handles`): keep **both** left and right handles for the
  ghost, positioned at the nub's edges. Body drag and dependency handles unchanged.
- Label positioning already handles "label wider than bar" (`big` class) — the nub will use
  that path; verify it reads acceptably.

### 3. Drag / extend / shrink (`src/index.js` + `src/bar.js`)

- On `mousedown` (in `bind_bar_events`): record a ghost's `owidth` as **logical `0`**, not
  the nub pixel width, so resize deltas are measured from zero.
- `update_bar_position` currently guards width updates with `if (width > 0)`. Change so that
  **`width === 0` is a valid state**:
  - `width === 0` → set rect to `ZERO_DURATION_NUB_WIDTH`, keep/add `bar-zero-duration`,
    keep `task._end === task._start`.
  - `width > 0` → set rect to the real width, remove `bar-zero-duration`.
  - Negative widths remain rejected.
- Date math (`compute_start_end_date`, `compute_duration`) must use the **logical** width so
  a ghost stays `start === end` until genuinely extended past one snap unit. Where these
  read `bar.getWidth()`, substitute the logical width when the bar is a ghost.
- Resize-left on a ghost extends the start earlier; resize-right extends the end later;
  body-drag moves start and end together (duration stays `0`).

### 4. Two-way auto transition

Because appearance is a pure function of logical width at each `update_bar_position` call,
no separate transition logic is needed:

- Extend a ghost ≥ one snap unit → logical width > 0 → solid bar (class removed) live.
- Shrink a normal bar to logical width `0` → ghost (nub + class) live.

### 5. Styling (`src/styles/gantt.css`)

`.bar-zero-duration` (and the wrapper as needed):

- dashed stroke outline,
- semi-transparent / hollow fill,
- visually distinct from both normal `.bar` and `.bar-invalid`.

### 6. Events

No new events. Extend / move / shrink fire the existing `date_change` and
`${last_action}_end` events. A bar shrunk to zero reports `start === end`.

## Edge cases

- `readonly` / `readonly_dates`: ghost is still rendered (so it's visible) but handles are
  suppressed exactly as for normal bars — no editing.
- Snapping: the existing `get_snap_position` applies; the first positive snap step is what
  converts a ghost into a real bar.
- Ignored regions / non-working days: extension uses the same ignored-region logic as normal
  resize; no special-casing beyond logical-vs-render width.
- Progress bar: a zero-duration bar has `0` progress width; the progress handle/logic must
  not divide by zero (guard already returns `0` for zero/negative spans — verify).
- `zero_duration_editable === false`: behaves exactly as today (no nub, no class, no
  handles for a 0-width rect).

## Testing

- **Rendering:** a task with `start === end` renders a nub with `bar-zero-duration` when the
  option is on; renders nothing grabbable when off.
- **Extend right:** dragging the right handle past one snap unit produces a positive
  duration, removes the ghost class, and fires `date_change` with `end > start`.
- **Extend left:** dragging the left handle earlier produces a positive duration with an
  earlier start.
- **Move:** dragging the body keeps duration `0` and shifts both start and end by the snap.
- **Shrink to zero:** resizing a normal bar down to `start === end` re-applies the ghost
  (class + nub) and reports `start === end`.
- **Date math:** a freshly rendered ghost reports `start === end` (the nub width does not
  leak into computed dates).
- **Option off:** zero-duration task keeps the current invisible behavior.
- Add unit coverage in `tests/bar.test.js` (and config defaults in the appropriate config
  test).

## Files touched (anticipated)

- `src/bar.js` — render width vs logical width, nub, ghost class, handles, date math.
- `src/index.js` — `update_bar_position` width-zero handling, mousedown owidth for ghosts.
- `src/defaults.js` — new `zero_duration_editable` default.
- `src/core/types.ts`, `src/core/config.ts` — option typing/normalization.
- `src/styles/gantt.css` — `.bar-zero-duration` styling.
- `tests/bar.test.js` (+ config test) — coverage.
- `README.md` / options docs — document the option.
