# Table Integration Guide

> **This is the most important guide for adopters.** The table-integration
> subsystem is `@gts-ui/chart-gantt`'s entire reason to exist. If you only read
> one document, read this one.

This guide explains how to embed the chart inside a host table so that the
timeline lives in **one full-height cell** while the table owns the columns,
the rows, the header strip, and the scroll container. It covers the integration
philosophy, the three integration seams, a copy-pasteable plain-HTML recipe, a
Vue 3 walkthrough modeled on the real `susp-frontend` consumer, the ID-mapping
contract, and a troubleshooting table.

See also: [API reference](./API.md) · [Data model](./DATA-MODEL.md) ·
[Events](./EVENTS.md).

---

## 1. Integration philosophy

### 1.1 Why there is no integrated grid

Tools like **dhtmlx-gantt** ship a *complete* product: a left-hand data grid,
a splitter, a timeline, and an internal scroll model that owns both panes. That
is convenient when the Gantt **is** your screen — and a liability when the Gantt
is one feature embedded in an application that already has a powerful,
opinionated table (sorting, virtual scrolling, grouping, inline editors,
column resizing, frozen columns, its own theming).

`@gts-ui/chart-gantt` makes the opposite bet:

> **A timeline-only Gantt with NO built-in table.** The consumer brings their
> own table; the chart renders only the bars, arrows, grid and timeline header,
> and binds itself into a single full-height cell of that host table.

Concretely, that means the library deliberately does **not** provide:

- a data grid / task list panel (the host's table columns are the "grid"),
- its own row model or row virtualization (the host owns rows),
- its own vertical scrollbar (the host's scroll container owns scroll).

What you get instead is a chart that is a *good tenant*: it accepts the host's
geometry (row heights, scroll position, header location) and renders into it.

### 1.2 The "single full-height cell + rowspan" model

The chart body is rendered into **one** `<td>` that spans every data row of the
host table using `rowspan`. The host's own columns sit to the left; the gantt
cell is the rightmost (or any single) column. Because the cell spans all data
rows, the gantt's internal rows can be aligned 1:1 to the host's table rows —
bar *N* sits at the vertical center of host row *N*.

```
┌──────────────┬──────────────┬───────────────────────────────────────────┐
│ Name (host)  │ Owner (host) │  Timeline HEADER  (sticky, header_mount)    │  ← sticky <thead>
├──────────────┼──────────────┼───────────────────────────────────────────┤
│ Task A       │ Alice        │                                             │
├──────────────┼──────────────┤   ████████  (bar A, centered in row A)      │
│ Task B       │ Bob          │            ████████ (bar B)                 │  ← ONE cell,
├──────────────┼──────────────┤                                             │     rowspan = N
│ Task C       │ Carol        │      ███████████ (bar C)                    │     height:100%
└──────────────┴──────────────┴───────────────────────────────────────────┘
                                ▲ the gantt body lives entirely in here
```

The cell is `height: 100%`; the gantt's container fills it. The timeline header
is rendered **elsewhere** (the sticky header area), and vertical scroll is
delegated to the table's scroll container. Those are the three seams below.

---

## 2. The three integration seams

The integration is exactly three explicit hooks, grouped under the `table`
option object in the new API:

```js
new Gantt(container, {
  tasks,
  table: {
    headerMount: '#my-sticky-header',     // seam (a)
    scrollElement: '#my-table-scroller',  // seam (b)
    rowHeights: { 'task-1': 48, ... },    // seam (c) — seed
    syncRowHeightsFrom: '#my-tbody',      // seam (c) — optional observer
  },
});
```

Each is described in detail below.

### 2.a Header mount (`table.headerMount`)

**Problem.** The timeline header (the upper/lower date columns) must stay
visible while the body scrolls vertically. If the header is part of the body
SVG inside the scrolling cell, it scrolls away.

**Solution.** Render the header into a **separate, sticky node** that you supply
— typically a cell inside the table's sticky `<thead>`. Pass a selector or an
element:

```js
table: { headerMount: '#gantt-header' }
```

**What the library does**

- It looks up the node (`document.querySelector(headerMount)`), adds the
  `gantt-header-container` class, and renders the timeline header **into that
  node** instead of into the body container.
- **`header_height` in the body becomes `0`.** When a header mount is present,
  the body grid no longer reserves vertical space for a header — rows start at
  `y = 0`. (Without a header mount, the body reserves
  `upper_header_height + lower_header_height + 10` px at the top.) This is what
  lets the body cell align row-for-row with the host's data rows: there is no
  header band stealing the first rows' vertical space.
- The same CSS custom properties (`--gv-bar-height`, `--gv-column-width`,
  `--gv-lower-header-height`, `--gv-upper-header-height`) are mirrored onto the
  header node so the detached header renders at the same scale as the body.

**Horizontal scroll sync.** The header and body must scroll together
horizontally so the date columns line up with the bars at every scroll offset.
The library keeps the header node's `scrollLeft` in sync with the body's during
scroll/reposition (e.g. on `set_scroll_position` and view changes). You do **not**
wire this yourself.

**Failure mode.** If the selector resolves to nothing, the library warns
(`options.header_mount defined, but wasn't found`) and falls back to rendering
the header inside the body container — at which point the header is no longer
sticky and `header_height` reverts to a non-zero band. A missing header mount is
the #1 cause of "header scrolled away" and "first row misaligned" reports.

**Requirements for the mount node**

- It must exist in the DOM **before** you construct the gantt.
- It should be inside (or be) your sticky `<thead>`/header strip so the browser
  keeps it pinned.
- It must have the same horizontal extent as the body cell so columns line up;
  give it `overflow: hidden` (the library drives its `scrollLeft`).

### 2.b External scroll (`table.scrollElement`)

**Problem.** In an embedded chart, *the host table already has a scroll
container.* If the gantt scrolls independently you get two scrollbars, desynced
vertical positions, and a header that drifts from the body.

**Solution.** Hand the chart the host's scroll container:

```js
table: { scrollElement: '#universal-table-42' }
```

**What the library does**

- On setup it resolves `this.$scroll_element = document.querySelector(scrollElement)`
  (falling back to its own container if not provided/found).
- The `ScrollController` **reads and writes scroll on that host element** rather
  than on the chart's own wrapper:
  - reads `scrollLeft` to compute the current date / current-column highlight and
    to drive `infinite_padding` extension,
  - writes `scrollLeft` for programmatic positioning (`scrollToToday`,
    `scroll_to`, view-change position preservation),
  - mirrors `scrollLeft` to the `headerMount` node so the detached header tracks
    the body.
- **Vertical scroll is entirely the host's.** The chart renders a body tall
  enough to contain all rows (sum of effective row heights); the host scroll
  container scrolls it. The chart does not add a vertical scrollbar.

**Requirements for the scroll element**

- It must be the element that actually clips & scrolls the table body
  (`overflow: auto`/`scroll`), i.e. the same container whose `scrollLeft`/
  `scrollTop` move your rows.
- It must exist before construction.
- It should be a stable node (don't swap it out from under the chart); on
  teardown the chart removes its listeners.

### 2.c Row-height sync (`table.rowHeights` + `table.syncRowHeightsFrom` + `rows` API)

**Problem.** Host table rows have arbitrary, dynamic heights (wrapped text,
inline editors, expanded detail rows). The gantt's bars must sit at the vertical
center of the **corresponding host row**, and stay centered when a host row
grows or shrinks.

**Model.** The chart maintains a `{ taskId: height }` map. For each task the
**effective height** is either the custom value or the default
`bar_height + padding`. Rows are laid out top-to-bottom by summing effective
heights; each bar is centered in its row:

```
row_top  = Σ effective_height(previous rows)        (+ header_height, which is 0 with a header mount)
bar.y    = row_top + (effective_height - bar_height) / 2
```

This is exactly `Bar.compute_y()` and `make_grid_rows()` — so seeding correct
heights makes the gantt rows line up with the host rows, and the
`(rowHeight - barHeight)/2` term keeps bars vertically centered regardless of
row height.

**Persistence across `setTasks`.** Runtime row heights survive a task reload.
The internal seed step is idempotent (`if (this.row_heights) return;`), so
heights pushed at runtime are not clobbered when you replace the task array.
This matters because the host typically reloads tasks (filter, refresh) far more
often than it resizes rows.

There are **two ways** to keep heights in sync; you can use either or both.

#### Push model (host calls `gantt.rows.set` / `update` / `reset`)

The host measures its own rows (it already knows them) and **pushes** heights
into the chart. This is the default, lowest-overhead, most predictable path:

```js
// seed at construction
table: { rowHeights: { 'task-1': 48, 'task-2': 72 } }

// later, when host rows change (fluent, chainable, re-renders once per call)
gantt.rows
  .set({ 'task-1': 56, 'task-2': 80 })   // bulk set
  .update('task-3', 64)                  // single row
  .reset('task-4');                      // back to default

gantt.rows.getAll();   // -> { 'task-1': 56, 'task-2': 80, 'task-3': 64, ... }
```

Notes on behavior (from the underlying implementation):

- Invalid heights (non-number, non-finite, `<= 0`) and unknown task ids are
  **warned and skipped**, never thrown — a bad measurement won't crash the host.
- Unknown ids in the seed are dropped with a warning; ids must match loaded
  tasks. (See the [ID mapping contract](#5-id-mapping-contract).)
- Each `rows.*` call triggers a single re-render and preserves label state.

#### Observer model (`table.syncRowHeightsFrom`, opt-in)

If you'd rather the chart watch the host rows itself, point it at the container
whose children are the host rows and it will attach a `ResizeObserver`, map each
observed row to a task id, push the measured height into the row-height model,
and re-render. This is **opt-in** — it is off unless you set it:

```js
table: {
  scrollElement: '#table-scroller',
  syncRowHeightsFrom: '#table-tbody',   // observe these rows
}
```

The observer maps a host row to a task by the row's id (normalized — see §5).
Use the observer when the host's row heights are driven by content you don't
control centrally; use the push model when the host already has the heights in
hand (it's cheaper and avoids observer churn during layout thrash). Mixing is
fine: seed + observer, or seed + occasional `rows.update`.

> **Migration note.** In the old API these were the loose options `row_heights`
> (seed) plus the methods `setRowHeights` / `updateRowHeight` / `resetRowHeight`
> / `getRowHeights`. The new API groups the seed under `table.rowHeights` and the
> methods under the fluent `gantt.rows` namespace
> (`set` / `update` / `reset` / `getAll`). See [MIGRATION.md](./MIGRATION.md).

---

## 3. Complete plain-HTML + JS recipe (copy-pasteable)

A minimal host table: real host columns on the left, a single rowspan cell on
the right holding the gantt body, and a sticky header cell holding the timeline
header.

```html
<!-- The scroll container the table lives in: this is table.scrollElement -->
<div id="table-scroller" style="height: 480px; overflow: auto; position: relative;">
  <table class="host-table" style="width: 100%; border-collapse: collapse;">
    <thead>
      <!-- Sticky header row: host column headers + the gantt header mount cell -->
      <tr>
        <th style="position: sticky; top: 0; background: #fff;">Task</th>
        <th style="position: sticky; top: 0; background: #fff;">Owner</th>
        <!-- The gantt timeline header is rendered INTO this node: table.headerMount -->
        <th
          id="gantt-header"
          style="position: sticky; top: 0; background: #fff; padding: 0; overflow: hidden;"
        ></th>
      </tr>
    </thead>

    <tbody id="table-tbody">
      <!-- One <tr> per task. Heights here drive the gantt row alignment. -->
      <tr id="task-1" style="height: 48px;">
        <td>Design</td>
        <td>Alice</td>
        <!-- The gantt body cell: spans ALL data rows, full height. -->
        <td
          id="gantt-cell"
          rowspan="3"
          style="padding: 0; height: 100%; vertical-align: top;"
        >
          <!-- The library mounts its SVG into this div. -->
          <div id="gantt-body" style="width: 100%; height: 100%;"></div>
        </td>
      </tr>
      <tr id="task-2" style="height: 72px;">
        <td>Build</td>
        <td>Bob</td>
        <!-- no gantt cell here — it's spanned by the rowspan above -->
      </tr>
      <tr id="task-3" style="height: 48px;">
        <td>Ship</td>
        <td>Carol</td>
      </tr>
    </tbody>
  </table>
</div>
```

```js
import Gantt from '@gts-ui/chart-gantt';

const tasks = [
  { id: 'task-1', name: 'Design', start: '2026-06-01', end: '2026-06-08', progress: 40 },
  { id: 'task-2', name: 'Build',  start: '2026-06-05', end: '2026-06-20', progress: 10, dependencies: 'task-1' },
  { id: 'task-3', name: 'Ship',   start: '2026-06-18', end: '2026-06-25', progress: 0,  dependencies: 'task-2' },
];

// Measure host rows so the gantt aligns row-for-row.
function measureRows() {
  const seed = {};
  for (const tr of document.querySelectorAll('#table-tbody > tr')) {
    seed[tr.id] = tr.getBoundingClientRect().height; // id MUST equal task.id (see §5)
  }
  return seed;
}

const gantt = new Gantt(document.getElementById('gantt-body'), {
  tasks,
  viewMode: 'Day',
  barHeight: 14,
  // padding = host row height - bar height keeps the DEFAULT row matched to the table
  padding: 48 - 14,
  table: {
    headerMount: '#gantt-header',     // (a) render the timeline header into the sticky cell
    scrollElement: '#table-scroller', // (b) delegate scroll to the host container
    rowHeights: measureRows(),        // (c) seed exact per-row heights
    // syncRowHeightsFrom: '#table-tbody', // (c) optional: let the chart observe row resizes
  },
});

// Typed events -> host persistence
gantt.on('date-change', ({ task, start, end }) => {
  // persist task.start/end for task.id
});
gantt.on('create-dependency', ({ from, to }) => {
  // create a relation from -> to
});

// If you use the push model, re-measure & push when host rows change:
function onHostRowsResized() {
  gantt.rows.set(measureRows());
}
```

---

## 4. Vue 3 integration walkthrough (modeled on `susp-frontend`)

This mirrors the real consumer at
`susp-frontend/src/components/tables/budget/cells/chart-gantt-cell.vue`, which
mounts the chart in a budget table cell, wires domain events to API calls, and
implements ctrl+wheel scale switching, a loading overlay, and a right-click
context menu on dependency arrows. The snippet below uses the **new camelCase
API**; a migration callout follows.

```vue
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import Gantt, { type Task, type Arrow } from '@gts-ui/chart-gantt';
import {
  GANTT_BAR_HEIGHT,
  GANTT_HEADER_ID,
  DEFAULT_TABLE_ROW_HEIGHT,
  GANTT_SCALE_ORDER,
} from '@/constants';

const props = defineProps<{ universalTableId: string }>();

const ganttEl = ref<HTMLElement | null>(null);        // body mount cell
const ganttWrapperEl = ref<HTMLElement | null>(null); // wheel target
const arrowContextMenuEl = ref<{ show: (e: PointerEvent) => void } | null>(null);

const isLoading = ref(false);
let gantt: Gantt | null = null;
let currentArrow: Arrow | null = null;

// ── domain event handlers (host translates chart events into API calls) ──
function onDateChange({ task, start, end }: { task: Task; start: Date; end: Date }) {
  // Validate, then stage the change; persist on mouseup (drag end).
  // task.id === host item id (see §5).
}

async function onCreateDependency({ from, to }: { from: string; to: string }) {
  isLoading.value = true;
  try {
    await api.createRelation(props.universalTableId, { parent_item_id: from, child_item_id: to });
    // refetch relations -> gantt.setTasks(...)
  } finally {
    isLoading.value = false;
  }
}

function onArrowRClick({ event, arrow }: { event: PointerEvent; arrow: Arrow }) {
  currentArrow = arrow;                 // remember which arrow for the menu command
  arrowContextMenuEl.value?.show(event);
}

onMounted(() => {
  if (!ganttEl.value) return;

  gantt = new Gantt(ganttEl.value, {
    tasks,
    viewMode: store.currentScale,                 // host owns the active scale
    barHeight: 14,
    padding: DEFAULT_TABLE_ROW_HEIGHT - GANTT_BAR_HEIGHT,
    progressBarPadding: 4,
    barCornerRadius: 3,
    language: 'ru',
    dateFormat: 'yyyy-MM-dd',
    infinitePadding: false,
    moveDependencies: false,
    todayButton: false,
    popup: false,                                 // host renders its own UI
    readonly: { progress: true },                 // progress bar is not editable here
    table: {
      headerMount: `#${GANTT_HEADER_ID}-${props.universalTableId}`,
      scrollElement: `#universal-table-${props.universalTableId}`,
      rowHeights: measureHostRows(),
    },
  });

  // typed events instead of on_* options
  gantt.on('date-change', onDateChange);
  gantt.on('create-dependency', onCreateDependency);
  gantt.on('arrow-rclick', onArrowRClick);

  // ── ctrl + wheel to step the timeline scale (Day -> Week -> Month ...) ──
  ganttWrapperEl.value?.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const idx = store.currentScaleIndex;
      if (event.deltaY < 0 && idx > 0) {
        store.setScale(idx - 1);                  // zoom in
      } else if (event.deltaY > 0 && idx < GANTT_SCALE_ORDER.length - 1) {
        store.setScale(idx + 1);                  // zoom out
      }
      gantt?.setViewMode(GANTT_SCALE_ORDER[store.currentScaleIndex]);
    },
    { passive: false },                           // required to call preventDefault
  );
});

onBeforeUnmount(() => {
  gantt?.destroy();                               // full teardown (was clear())
  gantt = null;
});
</script>

<template>
  <div class="chart-gantt-cell" ref="ganttWrapperEl">
    <!-- the gantt body mounts here; the header mounts into the sticky #GANTT_HEADER_ID cell elsewhere -->
    <div ref="ganttEl" class="chart-gantt-cell__chart-wrapper" />

    <!-- right-click-on-arrow context menu (delete / edit relation) -->
    <ContextMenu :model="arrowContextMenuItems" ref="arrowContextMenuEl" />

    <!-- loading overlay shown during create/delete relation round-trips -->
    <div v-if="isLoading" class="chart-gantt-cell__overlay">
      <div class="chart-gantt-cell__spinner" />
    </div>
  </div>
</template>
```

Key points from the real cell, preserved here:

- **Mount in `onMounted`** once the body `<div>` and the sticky header cell both
  exist in the DOM (the header mount must be present *before* construction).
- **`on('date-change')`** stages the start/end change; the real cell commits the
  API write on the global `mouseup` (i.e. when the drag ends), so a single drag
  produces one persistence call, not one per pointer-move.
- **`on('create-dependency')`** calls the relations API, then reloads tasks; the
  loading overlay (`isLoading`) covers the round-trip.
- **`on('arrow-rclick')`** captures the `Arrow` and opens a PrimeVue
  `ContextMenu`; its commands (delete/edit) resolve the relation from the arrow's
  `from_task.task.id` / `to_task.task.id`.
- **ctrl+wheel** steps the scale through `GANTT_SCALE_ORDER` and calls
  `setViewMode`; the chart preserves horizontal scroll position across the view
  change.
- **`popup: false`** because the host renders its own tooltips/menus.

### 4.1 Mini migration callout (snake_case → camelCase)

The real cell today still uses the legacy option names. The mapping to the new
API used above:

| Old (legacy cell)                         | New (this guide)                          |
|-------------------------------------------|-------------------------------------------|
| `new Gantt(el, opts)` with `header_mount`/`scroll_element_selector`/`row_heights` | `table: { headerMount, scrollElement, rowHeights }` |
| `on_date_change: fn`                       | `gantt.on('date-change', fn)`             |
| `on_create_dependency: fn`                | `gantt.on('create-dependency', fn)`       |
| `on_arrow_rclick: fn`                     | `gantt.on('arrow-rclick', fn)`            |
| `view_mode`                               | `viewMode`                                |
| `bar_height`                              | `barHeight`                               |
| `progress_bar_padding`                    | `progressBarPadding`                      |
| `bar_corner_radius`                       | `barCornerRadius`                         |
| `date_format`                             | `dateFormat`                              |
| `infinite_padding`                        | `infinitePadding`                         |
| `move_dependencies`                       | `moveDependencies`                        |
| `today_button`                            | `todayButton`                             |
| `readonly_progress: true`                 | `readonly: { progress: true }`            |
| `setRowHeights / updateRowHeight / resetRowHeight / getRowHeights` | `rows.set / rows.update / rows.reset / rows.getAll` |
| `refresh(tasks)`                          | `setTasks(tasks)`                         |
| `change_view_mode(m)`                     | `setViewMode(m)`                          |
| `clear()`                                 | `destroy()`                               |

Note that **task data fields stay snake_case** where the host already produces
them (`expected_start`, `custom_class`, etc.); only the *method/option* surface
becomes camelCase. The full table is in [MIGRATION.md](./MIGRATION.md).

---

## 5. ID mapping contract

The whole integration hinges on a single invariant:

> **`task.id` must equal the host row's item id.**

That is how the chart maps a bar to a host table row for row-height sync, how the
host resolves a `date-change` event back to a record (`tableStore.getItemById(task.id)`
in the real cell), and how dependencies reference endpoints.

### 5.1 Normalization caveat (spaces → underscores)

The library **normalizes ids** when parsing tasks: any space in `task.id` is
replaced with an underscore (`task.id = task.id.replaceAll(' ', '_')`), and
`dependencies` entries are normalized the same way. Internally, ids that flow
into DOM `data-*` attributes and generated element ids are sanitized further:
spaces, colons, and dots all become underscores (`"a b.c:d" -> "a_b_c_d"`).

Implications:

- **Prefer ids that are already underscore/dash-safe** (`task-1`, `wbs_1_2`).
  Avoid spaces, dots, and colons in ids you intend to look up.
- If your host item ids can contain spaces, **either** normalize your host's
  lookup the same way, **or** ensure the host row element ids you measure/observe
  use the *normalized* form. Otherwise `rowHeights` seeds and `syncRowHeightsFrom`
  mappings will miss (warned and skipped, not thrown) and that row won't align.
- Two ids that differ only by a space-vs-underscore (`"a b"` and `"a_b"`) collide
  after normalization. Keep ids globally unique *after* normalization.

A safe rule: make `task.id`, the host row's DOM `id`, and the host's record id
all the same normalized string.

---

## 6. Common pitfalls & troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| **Header scrolls away / not sticky** | No `table.headerMount`, or the mount node isn't inside a `position: sticky` header. Library warned `header_mount defined, but wasn't found` → it fell back into the body. | Provide a real sticky node that exists *before* construction; verify the selector resolves; ensure the `<thead>`/header cell is `position: sticky; top: 0`. |
| **First row / bars sit too low (a header-sized gap)** | Header mount not active, so `header_height` is the non-zero band (`upper+lower+10`) and rows start below it. | Set `table.headerMount` correctly; confirm the warning above is gone. With a valid mount, body `header_height` is `0`. |
| **Header columns drift from bars when scrolling** | Body scroll not delegated to the host container, so the chart's `scrollLeft` and the header's don't track. | Set `table.scrollElement` to the *actual* scrolling container; don't add a second scrollbar inside the cell. |
| **Two scrollbars / double scrolling** | Both the host container and the gantt cell are scrollable. | Make only `table.scrollElement` scrollable (`overflow:auto`); the gantt body cell should be `overflow: visible/hidden` and `height: 100%`. |
| **Rows misaligned with host table rows** | `rowHeights` not seeded (or stale), or ids don't match host rows. | Seed `table.rowHeights` from measured host rows; on resize push via `gantt.rows.set(...)` or use `table.syncRowHeightsFrom`. Verify ids per §5. |
| **Bars not vertically centered in tall rows** | `barHeight`/`padding` wrong, or the row's effective height isn't the host's. | Bar y is `row_top + (rowHeight - barHeight)/2`; ensure the effective height equals the host row height (seed/observe it) and `barHeight` matches your CSS bar. |
| **Some rows never align; console warns "task not found" / "Invalid row_heights entry"** | Seed/observer keyed by an id that doesn't match a loaded task, or a non-positive/NaN measured height. | Make host row ids equal `task.id` (normalized, §5); guard measurements so heights are finite and `> 0`. |
| **Ids with spaces don't match** | Library normalized spaces → underscores; your lookup still uses the spaced form. | Normalize host ids the same way (`replaceAll(' ', '_')`), or avoid spaces in ids entirely. |
| **Row heights reset after a task reload** | You expected `setTasks` to wipe runtime heights, or you re-seed with stale values. | Runtime heights *persist* across `setTasks` by design; re-push only when host rows actually changed. |
| **`date-change` fires many times during a drag** | Treating every event as a commit. | Stage on `date-change`, commit on drag end (`mouseup`), as the real cell does. |
| **Events don't fire after upgrade** | Still passing `on_date_change`/`on_create_dependency` options. | Use `gantt.on('date-change' | 'create-dependency' | 'arrow-rclick', ...)` (§4.1). |

---

## 7. Cross-references

- [API.md](./API.md) — full public API: constructor, `setTasks`, `setViewMode`,
  `scrollToToday`, the `rows` namespace, `on`/`off`, `destroy`.
- [DATA-MODEL.md](./DATA-MODEL.md) — `Task`, `Arrow`, `ViewMode`,
  `GanttOptions`, `TableIntegrationOptions`, and the event-map types.
- [EVENTS.md](./EVENTS.md) — every event, its payload, and when it fires
  (`date-change`, `progress-change`, `create-dependency`, `arrow-rclick`,
  `view-change`, `click`/`dblclick`/`hover`, `row-heights-change`).
