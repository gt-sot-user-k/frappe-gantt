# Migration Guide — `@gts-ui/chart-gantt`

This guide covers the **breaking major release** that ships the re-architected
`@gts-ui/chart-gantt`. It has two parts:

- **[Part A — Consumer migration](#part-a--consumer-migration)** — how to move
  application code (e.g. `susp-frontend`) from the old public API to the new one.
- **[Part B — Internal / contributor TS migration](#part-b--internal--contributor-typescript-migration)**
  — how the codebase itself is migrated to strict TypeScript, stage by stage.

> **Why this is breaking.** The old API grew organically around a single
> ~2,240-line `Gantt` god-object. The new API is a thin, fully-typed facade over
> a layered architecture (see `docs/ARCHITECTURE.md`). The public surface was
> redesigned from scratch; there is **no backwards-compatibility shim**. The
> real consumer (`susp-frontend`) is updated in lockstep with this release, and
> this document is the contract for that change.

---

# Part A — Consumer migration

## A.1 Overview — what changed at a high level

| Area | Old (≤ 0.0.x) | New (this release) |
|------|---------------|--------------------|
| **Construction** | `new Gantt(el, tasks, options)` — three positional args | `new Gantt(el, options)` — **single options object**; `tasks` is a field of `options` |
| **Events** | a soup of `on_*` **options** (`on_date_change`, `on_create_dependency`, …) | typed **`on()` / `off()`** subscriptions: `gantt.on('date-change', cb)` |
| **Event payloads** | **positional args** (`(task, start, end)`), `this` bound to the gantt instance | a **single typed payload object** (`{ task, start, end, source }`); no `this` binding |
| **Readonly flags** | flat `readonly`, `readonly_dates`, `readonly_progress`, `readonly_dependency` | grouped under **`readonly: { … }`** |
| **Table integration** | loose top-level options (`header_mount`, `scroll_element_selector`, `row_heights`, `progress_bar_padding`) | grouped under **`table: { … }`** |
| **Row heights** | four instance methods (`setRowHeights`, `updateRowHeight`, `resetRowHeight`, `getRowHeights`) | a **`rows` sub-API** (`gantt.rows.set/update/reset/getAll`), fluent |
| **Label panel** | built-in (`labels`, `label_button`, `label_filter` options) | an **opt-in plugin** (`LabelPanelPlugin`) registered via `plugins: [...]` |
| **Option casing** | `snake_case` | `camelCase` |
| **Teardown** | ad-hoc `clear()` (clears SVG only) | **`destroy()`** — full teardown (listeners, observers, plugins, DOM) |
| **Types** | `.d.ts` emitted from JS, effectively untyped | first-class strict TS types for options, methods and event payloads |

The **task data shape is unchanged**. `Task` fields the host already produces
(`id`, `name`, `start`, `end`, `duration`, `progress`, `dependencies`,
`expected_start`, `expected_end`, `custom_class`, `row_height`, …) keep their
existing `snake_case` names. Only the *method/option/event* API is redesigned.

## A.2 Constructor & methods

| Old | New | Notes |
|-----|-----|-------|
| `new Gantt(el, tasks, options)` | `new Gantt(el, { tasks, ...options })` | `tasks` moves **into** the options object |
| `gantt.refresh(tasks)` | `gantt.setTasks(tasks)` | replaces the whole task set and re-renders |
| `gantt.update_task(id, patch)` | `gantt.updateTask(id, patch)` | merge-patch a single task |
| `gantt.update_options(opts)` | `gantt.setOptions(opts)` | merge new options and re-render |
| `gantt.change_view_mode(mode)` | `gantt.setViewMode(mode)` | `mode` is the view-mode name string (or object) |
| `gantt.get_task(id)` | `gantt.getTask(id)` | returns the `Task` |
| `gantt.get_bar(id)` | `gantt.getBar(id)` | returns the `Bar` for a task id |
| `gantt.get_all_dependent_tasks(id)` | `gantt.getDependents(id)` | transitive dependents (via `DependencyGraph`) |
| `gantt.get_oldest_starting_date()` | `gantt.getOldestStartDate()` | earliest `_start` across tasks |
| `gantt.scroll_current()` | `gantt.scrollToToday()` | scroll the timeline to "today" |
| `gantt.set_scroll_position(date)` | `gantt.scrollTo(date)` | accepts a `Date`, ISO string, `'start' \| 'end' \| 'today'` |
| `gantt.setRowHeights(map)` | `gantt.rows.set(map)` | see [A.4](#a4-row-heights-sub-api) |
| `gantt.updateRowHeight(id, h)` | `gantt.rows.update(id, h)` | |
| `gantt.resetRowHeight(id)` | `gantt.rows.reset(id)` | |
| `gantt.getRowHeights()` | `gantt.rows.getAll()` | returns `{ [taskId]: px }` |
| `gantt.show_popup(opts)` | `gantt.showPopup(opts)` | |
| `gantt.hide_popup()` | `gantt.hidePopup()` | |
| `gantt.trigger_event(name, args)` | *(removed from public API)* | events flow through the internal `EventBus`; use `on()` to subscribe |
| `gantt.clear()` | `gantt.destroy()` | **semantics change**: `clear()` only wiped the SVG; `destroy()` removes all listeners, observers, plugins and detached DOM (header mount, popup, sidebar) |
| `Gantt.VIEW_MODE.DAY` (static) | `Gantt.VIEW_MODE.DAY` | **unchanged** — static view-mode constants are retained |

Internal-only methods that were never part of the documented surface
(`setup_*`, `make_*`, `bind_*`, `render`, `re_render_header`, `toggle_*`,
`init_label`, `view_is`, `get_snap_position`, `get_ignored_region`, …) are now
encapsulated inside the layered classes and are **not** part of the public API.
If you reached into any of these, you must migrate to the public methods above
or to a registered plugin.

### Fluent setters

Data/view/row setters return `this`, so calls chain:

```js
gantt.setViewMode('Week').setTasks(tasks).scrollToToday();
gantt.rows.set({ 't1': 80 }).update('t2', 64).reset('t3');
```

## A.3 Options renames

### A.3.1 Rendering & behavior options (top-level)

| Old (`snake_case`) | New (`camelCase`) | Default | Notes |
|--------------------|-------------------|---------|-------|
| `arrow_curve` | `arrowCurve` | `5` | dependency-arrow curve radius |
| `auto_move_label` | `autoMoveLabel` | `false` | reflow bar labels on horizontal scroll |
| `bar_corner_radius` | `barCornerRadius` | `3` | |
| `bar_height` | `barHeight` | `30` | |
| `container_height` | `containerHeight` | `'auto'` | number px or `'auto'` |
| `column_width` | `columnWidth` | `null` | overrides the per-view-mode width |
| `date_format` | `dateFormat` | `'YYYY-MM-DD HH:mm'` | |
| `upper_header_height` | `upperHeaderHeight` | `45` | |
| `lower_header_height` | `lowerHeaderHeight` | `30` | |
| `snap_at` | `snapAt` | `null` | snap granularity, e.g. `'1d'`, or `'unit'` |
| `infinite_padding` | `infinitePadding` | `true` | auto-extend timeline on scroll |
| `holidays` | `holidays` | weekend highlight | **unchanged** (config object) |
| `ignore` | `ignore` | `[]` | **unchanged** (`'weekend'` \| dates \| fn) |
| `language` | `language` | `'en'` | |
| `lines` | `lines` | `'both'` | `'both' \| 'vertical' \| 'horizontal' \| 'none'` |
| `move_dependencies` | `moveDependencies` | `true` | drag dependents with parent |
| `padding` | `padding` | `18` | vertical bar padding (row height = `barHeight + padding`) |
| `popup` | `popup` | default renderer | **unchanged-ish** — function or `false`; see [A.6](#a6-behavior-changes--gotchas) |
| `popup_on` | `popupOn` | `'click'` | `'click' \| 'hover'` |
| `scroll_to` | `scrollTo` | `'today'` | initial scroll target |
| `show_expected_progress` | `showExpectedProgress` | `false` | |
| `expected_date_line` | `expectedDateLine` | `false` | |
| `today_button` | `todayButton` | `true` | |
| `expected_line_button` | `expectedLineButton` | `false` | |
| `view_mode` | `viewMode` | `'Day'` | |
| `view_mode_select` | `viewModeSelect` | `false` | show the view-mode dropdown |
| `view_modes` | `viewModes` | `DEFAULT_VIEW_MODES` | |
| — | `tasks` | `[]` | **new**: the task array (was a positional constructor arg) |
| — | `plugins` | `[]` | **new**: array of `GanttPlugin` instances |

### A.3.2 Readonly flags → `readonly` group

The four flat readonly flags are grouped into one object.

| Old | New |
|-----|-----|
| `readonly: true` | `readonly: true` *(boolean shorthand still means "all")* or `readonly: { all: true }` |
| `readonly_dates: true` | `readonly: { dates: true }` |
| `readonly_progress: true` | `readonly: { progress: true }` |
| `readonly_dependency: true` | `readonly: { dependencies: true }` |

```js
// old
{ readonly_progress: true, readonly_dates: false }
// new
{ readonly: { progress: true } }
```

### A.3.3 Table-integration options → `table` group (the differentiator)

These loose top-level options are the library's actual selling point (single
full-height host cell + detached header + host-owned scroll + row-height sync).
They are now grouped under `table`. See `docs/INTEGRATION.md` for the full recipe.

| Old (top-level) | New (under `table`) | Notes |
|-----------------|---------------------|-------|
| `header_mount` | `table.headerMount` | selector or `HTMLElement` for the detached sticky header |
| `scroll_element_selector` | `table.scrollElement` | selector or `HTMLElement` of the host scroll container |
| `row_heights` | `table.rowHeights` | seed `{ [taskId]: px }` map |
| `progress_bar_padding` | `table.progressBarPadding` | progress-bar vertical inset |
| *(new)* | `table.syncRowHeightsFrom` | opt-in: a host element whose rows are observed (`ResizeObserver`) and pushed into the chart's row heights |

```js
// old
{
  header_mount: '#gantt-header-42',
  scroll_element_selector: '#universal-table-42',
  row_heights: seed,
  progress_bar_padding: 4,
}
// new
{
  table: {
    headerMount: '#gantt-header-42',
    scrollElement: '#universal-table-42',
    rowHeights: seed,
    progressBarPadding: 4,
  },
}
```

### A.3.4 Label panel → `LabelPanelPlugin`

The label side-panel is no longer in core. Its three options move into the
plugin's own config namespace; register the plugin via `plugins`.

| Old (top-level) | New (LabelPanelPlugin config) |
|-----------------|-------------------------------|
| `labels` | `new LabelPanelPlugin({ columns: labels })` |
| `label_button` | `new LabelPanelPlugin({ button: true })` |
| `label_filter` | `new LabelPanelPlugin({ filter: true })` |

```js
// old
new Gantt(el, tasks, {
  labels: [{ name: 'Owner', ... }],
  label_button: true,
  label_filter: true,
});

// new
import Gantt, { LabelPanelPlugin } from '@gts-ui/chart-gantt';

new Gantt(el, {
  tasks,
  plugins: [
    new LabelPanelPlugin({
      columns: [{ name: 'Owner', ... }],
      button: true,
      filter: true,   // still capped at max 3 visible columns
    }),
  ],
});
```

If you do **not** register `LabelPanelPlugin`, the core renders a pure timeline
with no label panel, no "Label" side-header button, and no label scroll-sync —
this is intentional (core is now a pure timeline). See `docs/PLUGINS.md`.

## A.4 Event callbacks (`on_*` options → `on(name, cb)`)

Every `on_*` **option** becomes an `on()` **subscription** with a kebab-case
event name and a **single typed payload object**. The old callbacks received
**positional arguments** and were invoked with `this` bound to the gantt
instance; the new callbacks receive **one object** and are plain functions
(no `this` binding).

| Old option | Old positional args | New event name | New payload object |
|------------|---------------------|----------------|--------------------|
| `on_date_change` | `(task, start, end)` | `'date-change'` | `{ task, start, end, source }` |
| `on_left_resizing_end` | `(task, start, end)` | `'resize-left'` | `{ task, start, end }` |
| `on_right_resizing_end` | `(task, start, end)` | `'resize-right'` | `{ task, start, end }` |
| `on_dragging_end` | `(task, start, end)` | `'drag-end'` | `{ task, start, end }` |
| `on_progress_change` | `(task, progress)` | `'progress-change'` | `{ task, progress }` |
| `on_create_dependency` | `(from_task, to_task)` | `'create-dependency'` | `{ from, to }` *(task objects)* |
| `on_dependency_handle_mousedown` | `(bar, handle)` | `'dependency-handle-down'` | `{ bar, handle }` |
| `on_arrow_rclick` | `(event, arrow)` | `'arrow-rclick'` | `{ event, arrow }` |
| `on_view_change` | `(mode)` | `'view-change'` | `{ mode }` |
| `on_click` | `(task)` | `'click'` | `{ task }` |
| *(was `'double_click'` via `trigger_event`)* | `(task)` | `'dblclick'` | `{ task }` |
| *(was `'hover'` via `trigger_event`)* | `(task, screenX, screenY, event)` | `'hover'` | `{ task, screenX, screenY, event }` |
| *(new)* | — | `'row-heights-change'` | `{ heights }` |

> **Note on `on_date_change` vs gesture-specific events.** In the old code a
> drag/resize fired **both** `on_date_change` *and* the gesture-specific
> `on_<last_action>_end` (`dragging_end` / `resizing_left_end` /
> `resizing_right_end`). The new API preserves this: `'date-change'` fires for
> any date mutation and carries a `source` discriminator
> (`'drag' | 'resize-left' | 'resize-right'`), and the gesture-specific events
> (`'drag-end'`, `'resize-left'`, `'resize-right'`) also fire. Prefer
> `'date-change'` + `source` for most hosts.

```js
// old — callbacks as options, positional args, `this` === gantt
new Gantt(el, tasks, {
  on_date_change(task, start, end) { persist(task, start, end); },
  on_create_dependency(from, to) { createRelation(from.id, to.id); },
  on_arrow_rclick(e, arrow) { showMenu(e, arrow); },
});

// new — subscriptions, one payload object, no `this`
const gantt = new Gantt(el, { tasks });
gantt.on('date-change', ({ task, start, end }) => persist(task, start, end));
gantt.on('create-dependency', ({ from, to }) => createRelation(from.id, to.id));
gantt.on('arrow-rclick', ({ event, arrow }) => showMenu(event, arrow));
```

`on()` returns an unsubscribe function; `off(name, cb)` and `once(name, cb)`
are also available:

```js
const unsub = gantt.on('progress-change', handler);
unsub();                        // or: gantt.off('progress-change', handler);
gantt.once('view-change', handler);
```

## A.5 Concrete before/after — the `susp-frontend` cell

This is the real consumer
(`susp-frontend/src/components/tables/budget/cells/chart-gantt-cell.vue`),
mounted through a Pinia store (`ganttStore.installGantt(el, options)`). Below is
the options block + the three domain handlers, translated to the new API.

### Before

```ts
ganttStore.installGantt(ganttEl.value, {
  date_format: 'yyyy-MM-dd',
  header_mount: `#${GANTT_HEADER_ID}-${props.universalTableId}`,
  bar_height: 14,
  language: 'ru',
  today_button: false,
  infinite_padding: false,
  padding: DEFAULT_TABLE_ROW_HEIGHT - GANTT_BAR_HEIGHT,
  progress_bar_padding: 4,
  readonly_progress: true,
  bar_corner_radius: 3,
  view_mode: ganttStore.currentScale,
  move_dependencies: false,
  scroll_element_selector: `#universal-table-${props.universalTableId}`,
  on_date_change: onDateChange,            // (task, start, end)
  on_create_dependency: onCreateDependency, // (fromTask, toTask)
  on_arrow_rclick: onArrowRClick,           // (e, arrow)
  popup: false,
});

async function onDateChange(task: Task, start: Date, end: Date) { /* ... */ }
async function onCreateDependency(fromTask: Task, toTask: Task) { /* ... */ }
async function onArrowRClick(e: PointerEvent, arrow: Arrow) { /* ... */ }
```

### After

```ts
const gantt = ganttStore.installGantt(ganttEl.value, {
  dateFormat: 'yyyy-MM-dd',
  barHeight: 14,
  language: 'ru',
  todayButton: false,
  infinitePadding: false,
  padding: DEFAULT_TABLE_ROW_HEIGHT - GANTT_BAR_HEIGHT,
  barCornerRadius: 3,
  viewMode: ganttStore.currentScale,
  moveDependencies: false,
  readonly: { progress: true },          // was readonly_progress: true
  popup: false,
  table: {                               // grouped integration seam
    headerMount: `#${GANTT_HEADER_ID}-${props.universalTableId}`,
    scrollElement: `#universal-table-${props.universalTableId}`,
    progressBarPadding: 4,
  },
});

// events: subscribe instead of passing on_* options
gantt.on('date-change', ({ task, start, end }) => onDateChange(task, start, end));
gantt.on('create-dependency', ({ from, to }) => onCreateDependency(from, to));
gantt.on('arrow-rclick', ({ event, arrow }) => onArrowRClick(event, arrow));

// the handler signatures themselves are unchanged — only how they are wired
async function onDateChange(task: Task, start: Date, end: Date) { /* ... */ }
async function onCreateDependency(fromTask: Task, toTask: Task) { /* ... */ }
async function onArrowRClick(e: PointerEvent, arrow: Arrow) { /* ... */ }
```

Notes for this cell specifically:

- `installGantt` should **return the `Gantt` instance** so the component can
  call `gantt.on(...)` and `gantt.destroy()` on unmount.
- The ctrl+wheel scale-stepping and the `mouseup` persistence listener in the
  component are host-owned and **do not change** — they live outside the chart.
- On `onUnmounted`, call `gantt.destroy()` (the old code relied on implicit
  teardown). This removes the chart's listeners on the host `scrollElement` and
  the detached `headerMount` node.
- `Arrow.from_task.task.id` / `to_task.task.id` access used by `findRelation`
  is **unchanged** — `Arrow` keeps its `from_task` / `to_task` bar references.

## A.6 Behavior changes / gotchas

1. **Event payloads are objects, not positional args.** Destructure the payload:
   `({ task, start, end }) => …`. Code that read `arguments[1]` or relied on arg
   order will break.
2. **No `this` binding in handlers.** Old `on_*` callbacks were invoked with
   `this === gantt`. New `on()` handlers are plain callbacks. Capture the
   instance from the `new Gantt(...)` return value instead of `this`.
3. **`tasks` is now an option, not a constructor arg.** `new Gantt(el, tasks, opts)`
   → `new Gantt(el, { tasks, ...opts })`.
4. **`clear()` → `destroy()` is a semantic upgrade, not a rename.** `clear()`
   only emptied the SVG (used internally between renders). `destroy()` is the
   public teardown: detaches all DOM, removes document/host listeners and
   `ResizeObserver`s, and calls `destroy()` on every registered plugin. Call it
   on unmount to avoid leaks, especially with `table.scrollElement` /
   `table.headerMount` pointing at host-owned nodes.
5. **The label panel must be registered as a plugin.** Passing `labels` /
   `label_button` / `label_filter` at the top level no longer does anything.
   Import and register `LabelPanelPlugin`. Core no longer references labels at
   all (no scroll-sync hooks, no side-header "Label" button).
6. **`readonly` is now a group.** The boolean shorthand `readonly: true` still
   means "everything readonly"; per-axis flags move under the object.
7. **`popup` is essentially unchanged.** It is still a render function (receiving
   a popup context with `set_title`/`set_subtitle`/`set_details`, the `task`, and
   the chart) or `false` to disable. The default renderer is unchanged. Only the
   option name casing is the same (`popup`), and `popup_on` → `popupOn`.
8. **`refresh()` → `setTasks()`** replaces the task set and re-renders while
   preserving scroll position, same as before. Per-row custom heights persist
   across `setTasks()` (kept in the `RowHeightModel`), matching the old
   "row heights survive refresh" behavior.
9. **Removed public method `trigger_event`.** Hosts cannot synthesize internal
   events. Use `on()` to listen; there is no public emit.
10. **`update_task` → `updateTask`** still merge-patches a single task and
    re-renders only that bar.

---

# Part B — Internal / contributor TypeScript migration

This part is for contributors working **inside** `@gts-ui/chart-gantt`. It
describes how the monolith is decomposed and converted to strict TypeScript
without ever shipping a broken build.

## B.1 Staged migration table

The migration is **bottom-up**: a converted file never imports an unconverted
file downstream of it. Each stage compiles green and keeps the existing test
suite passing. `strict` is enabled per-file as files convert, then flipped
globally at the end.

| Stage | Converts | What it covers | Guarantee at end of stage |
|-------|----------|----------------|---------------------------|
| **0** | **Tooling** | `tsconfig` strict path scaffolding; vitest `jsdom` environment wiring; ensure Vite + `vite-plugin-dts` can build a `.ts` entry. | **No behavior change.** Existing JS still builds and all tests stay green. |
| **1** | **Leaf utils** | `svg_utils`, `date_utils`, and `defaults` → typed `Config` / `ViewMode` definitions. No DOM dependencies. | Pure leaves are strict-typed; everything that imports them still compiles. Tests green. |
| **2** | **Pure core** | `TaskStore`, `DependencyGraph`, `RowHeightModel`, `TimeScale`, `EventBus`, `Config` — **extracted from `index.js`** with TDD-first. | The correctness core is strict-typed and unit-tested (no DOM). Tests green. |
| **3** | **Renderers** | `LayerManager`, `GridRenderer`, `HeaderRenderer`, `Bar`, `Arrow`, `DummyArrow` — decoupled via injected read-only contexts (`BarContext`, `ArrowContext`) instead of reaching into the `Gantt` instance. | Render layer is strict-typed; ~60 `this.gantt.*` reach-backs in `Bar` are removed. DOM suites (jsdom) green. |
| **4** | **Controllers** | `InteractionController` (drag/resize/progress/dependency gestures) and `ScrollController` (scroll sync, `scrollElement` seam, infinite-padding extend). | Interaction layer strict-typed; the ~350-line `bind_bar_events` / `bind_bar_progress` is relocated and covered. Tests green. |
| **5** | **Facade + integration** | The `Gantt` facade, `TableAdapter`, the plugin host, and `LabelPanelPlugin`. **Delete the monolith** (`index.js`). Flip `strict: true` **globally**; emit `.d.ts` from real TS; **swap the public API** (Part A) and update `susp-frontend`. | Monolith gone; whole codebase strict TS; new breaking API live; host updated in lockstep. |

## B.2 The strangler approach

Although the **end-state public API is breaking**, the **internal migration is
incremental** — a classic *strangler fig* pattern:

1. The monolithic `Gantt` class in `index.js` keeps exporting its existing
   surface throughout stages 0–4 so the build never breaks.
2. At each stage, a bounded responsibility is **extracted into its own class**
   (e.g. `TimeScale` lifts `setup_dates` / `get_snap_position` /
   `get_ignored_region`; `RowHeightModel` lifts the `row_heights` methods). The
   monolith is **hollowed out**: its old methods become thin delegations to the
   new class, so behavior is unchanged and tests stay green.
3. New classes communicate **upward only via the `EventBus`** and **downward only
   via injected read-only contexts** — no class reaches back into `Gantt`. This
   is what makes each extracted unit independently testable and typable.
4. Only at **stage 5** is the facade swapped for the thin new `Gantt`, the old
   monolith file deleted, and the host (`susp-frontend`) updated to the new API
   (Part A). The library is shippable at every prior stage; the breaking swap is
   a single, final, coordinated step.

**Rationale / risk control** (from the design spec):

- Extract `TimeScale` *first* (with TDD + characterization tests on current
  geometry) so bar geometry is verified before `Bar` is rewired — this de-risks
  the 60+ `this.gantt.*` reach-back removal in stage 3.
- Keep the proven scroll/header-sync logic intact and just **relocate** it into
  `ScrollController`; cover the two seams (`headerMount`, `scrollElement`) with
  dedicated jsdom tests because that logic is timing-sensitive.
- Because the monolith is only deleted at stage 5, a stalled migration still
  leaves a shippable library.

## B.3 tsconfig / vitest changes

### TypeScript (strict rollout)

- **Stage 0** lays down the strict-capable `tsconfig` and ensures the build
  toolchain (Vite + `vite-plugin-dts`) can consume a `.ts` entry point.
- **Per-file ratcheting:** `strict: true` is enabled for converted files as the
  `include` set grows (or via per-file ratcheting), so each stage is strict for
  exactly what it converted without forcing the whole tree at once.
- **Stage 5** flips `strict: true` **globally** and emits `.d.ts` from real
  TypeScript (not `tsc --allowJs` over JS). This is what finally makes the public
  API genuinely typed for consumers.

### Vitest (jsdom for DOM suites)

**Clarification:** jsdom does **not** replace vitest. Vitest stays the test
runner; jsdom is the *DOM environment* a test executes in. Today the suite runs
in vitest's `node` environment (no `document`), which is why only pure-logic
files are tested and the rendering/interaction layers are not.

- **Pure-logic suites stay in `node`** (fast): `TimeScale`, `TaskStore`,
  `DependencyGraph`, `RowHeightModel`, `Config`, `EventBus`, `date_utils`.
- **DOM-dependent suites run in `jsdom`** (add `jsdom`, or the lighter
  `happy-dom`, as a dev dependency): `GridRenderer`, `HeaderRenderer` (mount
  seam), `Bar` (draw + drag math), `ScrollController` (sync), `TableAdapter`
  (`ResizeObserver` → re-render).

Two ways to scope the split. **Per-file opt-in is the default**, falling back to
a glob rule if it gets noisy:

```ts
// per-file (preferred): a DOM test declares its environment at the top
// bar.dom.test.ts
// @vitest-environment jsdom
```

```js
// or by glob, in vitest.config.js:
test: {
  globals: true,
  environmentMatchGlobs: [
    ['tests/**/*.dom.test.ts', 'jsdom'], // DOM-dependent suites
    ['tests/**/*.test.ts', 'node'],      // pure-logic suites stay fast
  ],
}
```

CI continues to run `vitest run` (already wired in `package.json`). Pure-logic
layers (model / scale / config) target high coverage as the correctness core;
renderers and controllers target behavioral coverage of the documented features
(see `docs/FEATURES.md`).

---

## See also

- `docs/ARCHITECTURE.md` — the layered design behind the new API.
- `docs/API.md` — full public API reference.
- `docs/EVENTS.md` — event reference with payloads and timing.
- `docs/INTEGRATION.md` — the table-integration guide (the three seams + host recipe).
- `docs/PLUGINS.md` — plugin interface and `LabelPanelPlugin`.
