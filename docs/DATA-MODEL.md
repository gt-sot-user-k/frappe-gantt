# Data Model — `@gts-ui/chart-gantt`

> **Status:** Canonical TypeScript schema reference for the re-architected public
> API. This document is the source of truth for *types*. For the prose options
> table see [`API.md`](./API.md); for event payloads and timing see
> [`EVENTS.md`](./EVENTS.md); for the table-integration recipe see
> [`INTEGRATION.md`](./INTEGRATION.md).
>
> **Naming convention.** Task *data* fields keep `snake_case` because the host
> (`susp-frontend`) produces them directly and they are part of the wire data
> (`id`, `name`, `start`, `end`, `progress`, `dependencies`, `expected_start`,
> `expected_end`, `custom_class`, `color`, `color_progress`, `thumbnail`,
> `row_height`, `invalid`). The *new public option/method API* uses idiomatic
> `camelCase` (`viewMode`, `barHeight`, `table.headerMount`, …). The mapping
> between the old `snake_case` options and the new `camelCase` ones lives in
> [`MIGRATION.md`](./MIGRATION.md).

---

## Table of contents

1. [`Task`](#1-task)
2. [`DateInput` and date string formats](#2-dateinput-and-date-string-formats)
3. [`Duration`](#3-duration)
4. [`ViewMode`](#4-viewmode)
5. [`GanttOptions`](#5-ganttoptions)
6. [`TableIntegrationOptions`](#6-tableintegrationoptions)
7. [`Arrow`](#7-arrow)
8. [`GanttEventMap`](#8-gantteventmap)
9. [Holidays & ignore config](#9-holidays--ignore-config)

---

## 1. `Task`

A `Task` is one row of the chart. The host supplies the **input** fields; the
chart annotates each task object **in place** with computed/internal fields
(prefixed `_` or otherwise marked "computed"). Consumers should treat the
computed fields as read-only.

```ts
/**
 * A single task / row in the Gantt chart.
 *
 * Input fields are provided by the host. Fields marked "computed" are written
 * back onto the task object by the chart during setup/refresh and render, and
 * must be treated as read-only by consumers.
 */
export interface Task {
  /**
   * Unique identifier. Spaces are normalized to underscores
   * (`"task 1"` → `"task_1"`). Non-string ids are coerced to string.
   * If omitted, an id is auto-generated.
   */
  id: string;

  /** Display name, rendered as the bar label and the popup title. */
  name: string;

  /** Start date. @see DateInput */
  start: DateInput;

  /**
   * End date. @see DateInput
   * If the end has no time component (midnight), the chart treats the last day
   * as a full day by adding 24h internally (`2018-09-09` → `2018-09-09 23:59:59`).
   */
  end: DateInput;

  /**
   * Duration string (e.g. `"3d"`, `"1w"`) — an alternative to `end`.
   * @see Duration
   */
  duration?: Duration;

  /** Completion percentage, 0–100. Clamped to the range during render. */
  progress?: number;

  /**
   * Dependency task ids. Accepted as a comma-separated string
   * (`"a, b"`) or a string array; **normalized to `string[]`** during setup
   * (trimmed, spaces→underscores, empties dropped).
   */
  dependencies?: string | string[];

  /** Expected (baseline) start, used by the expected-progress / expected-line overlays. */
  expected_start?: DateInput;

  /** Expected (baseline) end, used by the expected-progress / expected-line overlays. */
  expected_end?: DateInput;

  /** Extra CSS class applied to the bar's `<g class="bar-wrapper">`. */
  custom_class?: string;

  /** Inline fill color for the bar rect (`$bar.style.fill`). */
  color?: string;

  /** Inline fill color for the progress rect (`$bar_progress.style.fill`). */
  color_progress?: string;

  /** Image URL rendered as a clipped thumbnail at the start of the bar. */
  thumbnail?: string;

  /** Free-text shown as the popup subtitle (default popup renderer). */
  description?: string;

  /**
   * Per-row height in px. Overrides the default row height
   * (`barHeight + padding`) for this row only. Seeded from
   * `table.rowHeights` and persisted across `setTasks`/refresh.
   */
  row_height?: number;

  /**
   * Marks the task as invalid. Invalid bars render with the `bar-invalid`
   * class and skip progress/resize/dependency handles and interaction.
   */
  invalid?: boolean;

  // ───────────────────────── computed / internal ─────────────────────────

  /** computed — zero-based render order index, cached during setup. */
  readonly _index?: number;

  /** computed — parsed `start` as a `Date`. */
  readonly _start?: Date;

  /** computed — parsed `end` as a `Date` (after the full-day adjustment). */
  readonly _end?: Date;

  /**
   * computed — whole days in the span that are **not** ignored
   * (excludes weekends/holidays per the `ignore` config).
   */
  readonly actual_duration?: number;

  /**
   * computed — whole days in the span that **are** ignored
   * (`total_days − actual_duration`).
   */
  readonly ignored_duration?: number;
}
```

### Field summary

| Field | Type | Required | Computed | Notes |
|-------|------|:--------:|:--------:|-------|
| `id` | `string` | yes\* | — | Spaces → `_`; auto-generated if absent |
| `name` | `string` | yes | — | Bar label & popup title |
| `start` | `DateInput` | yes | — | string or `Date` |
| `end` | `DateInput` | yes\*\* | — | midnight end → +24h internally |
| `duration` | `Duration` | no | — | alternative to `end` |
| `progress` | `number` | no | — | 0–100, clamped |
| `dependencies` | `string \| string[]` | no | — | normalized to `string[]` |
| `expected_start` | `DateInput` | no | — | baseline overlays |
| `expected_end` | `DateInput` | no | — | baseline overlays |
| `custom_class` | `string` | no | — | extra class on bar group |
| `color` | `string` | no | — | bar fill |
| `color_progress` | `string` | no | — | progress fill |
| `thumbnail` | `string` | no | — | clipped image URL |
| `description` | `string` | no | — | popup subtitle |
| `row_height` | `number` | no | — | px; overrides row default |
| `invalid` | `boolean` | no | — | renders `bar-invalid`, no interaction |
| `_index` | `number` | — | yes | render order |
| `_start` | `Date` | — | yes | parsed start |
| `_end` | `Date` | — | yes | parsed end (+24h adj.) |
| `actual_duration` | `number` | — | yes | non-ignored days |
| `ignored_duration` | `number` | — | yes | ignored days |

\* Optional on input (auto-generated), but always present after setup.
\*\* Either `end` or `duration` must be supplied.

### Worked example

```ts
const task: Task = {
  id: 'design-phase',
  name: 'Design phase',
  start: '2026-06-01',
  end: '2026-06-12',
  progress: 40,
  dependencies: ['kickoff'],            // or "kickoff, research"
  expected_start: '2026-06-01',
  expected_end: '2026-06-10',
  custom_class: 'phase-design',
  color: '#3b82f6',
  color_progress: '#1d4ed8',
  thumbnail: 'https://cdn.example.com/avatars/design.png',
  description: 'Wireframes, visual design, design review.',
  row_height: 64,
};

// After the chart runs setup + render, the SAME object also carries:
// task._index            → 2
// task._start            → Date(2026-06-01T00:00:00)
// task._end              → Date(2026-06-13T00:00:00)   // midnight-end +24h
// task.actual_duration   → 9    // working days within the span
// task.ignored_duration  → 3    // weekend days within the span
// task.dependencies       → ['kickoff']  // normalized to string[]
```

---

## 2. `DateInput` and date string formats

```ts
/** Anywhere the chart accepts a date, it accepts either a string or a Date. */
export type DateInput = string | Date;
```

A `Date` is used as-is. A `string` is parsed by `date_utils.parse`, which splits
on a space into a date part and an optional time part:

- **Date part** — separated by `-`: `YYYY-MM-DD` (month and day are optional;
  missing month defaults to January, missing day to the 1st).
- **Time part** — separated by `:` or `.`: `HH:mm:ss.SSS`. A 4th group after the
  seconds is treated as fractional seconds (milliseconds).

Accepted input string formats:

| Format | Example | Meaning |
|--------|---------|---------|
| `YYYY-MM-DD` | `2026-06-22` | date only (midnight) |
| `YYYY-MM-DD HH:mm:ss.SSS` | `2026-06-22 09:30:00.000` | date + time |

Invalid strings throw `Error("Invalid date string: …")`; non-string/non-Date
input throws `TypeError`.

### Format tokens (output via `date_utils.format`)

`date_utils.format(date, format, lang)` substitutes these tokens (longest token
matched first, so `YYYY` wins over a bare `Y`, `MMMM` over `MM`, etc.):

| Token | Output | Example (`2026-06-09 14:05:07.250`) |
|-------|--------|-------------------------------------|
| `YYYY` | 4-digit year | `2026` |
| `MM` | 2-digit month (01–12) | `06` |
| `DD` | 2-digit day (01–31) | `09` |
| `D` | day of month (no pad) | `09` |
| `HH` | 2-digit hours (00–23) | `14` |
| `mm` | 2-digit minutes | `05` |
| `ss` | 2-digit seconds | `07` |
| `SSS` | milliseconds | `25` |
| `MMMM` | full month name, capitalized | `June` |
| `MMM` | short month name | `Jun` |

### Localization

`MMMM` and `MMM` are produced via `Intl.DateTimeFormat(lang, { month: 'long' | 'short' })`,
so month/day names follow the locale passed in the `language` option (default
`'en'`). The same `language` value flows into every header `DateTextFn` (the
`lang` argument) and the default popup renderer.

---

## 3. `Duration`

A template-literal type for durations used by view modes (`step`, `padding`,
`snap_at`) and the optional task `duration` field.

```ts
/** e.g. "1h", "6h", "1d", "7d", "1w", "1m", "2m", "1y", "2y" */
export type Duration = `${number}${'h' | 'd' | 'w' | 'm' | 'y'}`;
```

> **Runtime note:** `date_utils.parse_duration` also recognizes `min` (minute),
> `s` (second) and `ms` (millisecond) suffixes for completeness; `w` (week) is
> accepted by the type but the built-in view modes express weeks as `7d`. The
> public `Duration` type intentionally narrows to the suffixes the view-mode API
> uses.

Durations are parsed into a `{ duration, scale }` pair:

```ts
interface ParsedDuration {
  duration: number;   // numeric quantity
  scale: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond';
}

// parse_duration("6h") → { duration: 6, scale: "hour" }
// parse_duration("2m") → { duration: 2, scale: "month" }   // NB: m = month
// parse_duration("1y") → { duration: 1, scale: "year" }
```

> **Gotcha:** the suffix `m` means **month**, not minute. Minutes use `min`.

---

## 4. `ViewMode`

```ts
/** A resolved timeline view-mode definition. */
export interface ViewMode {
  /** Display name and lookup key (e.g. "Day", "Week"). */
  name: string;

  /** Width of one column = one `step` of the scale. */
  step: Duration;

  /** Empty timeline padding added before/after the task range. */
  padding: Duration;

  /** Format string used when scanning columns (drives `get_dates_to_draw`). */
  date_format: string;

  /** Lower (per-column) header text: a format string or a function. */
  lower_text: string | DateTextFn;

  /** Upper (grouping) header text: a format string or a function. */
  upper_text?: string | DateTextFn;

  /** Per-mode column width in px (falls back to the global default if unset). */
  column_width?: number;

  /** Draw the upper-header label only every Nth column. */
  upper_text_frequency?: number;

  /** Predicate marking columns that get a heavier grid line. */
  thick_line?: (date: Date) => boolean;

  /** Snap granularity while dragging/resizing in this mode. */
  snap_at?: Duration;
}

/**
 * Header text callback.
 * @param current   the column's date
 * @param previous  the previous column's date (null for the first column)
 * @param lang      the active `language` option
 */
export type DateTextFn = (
  current: Date,
  previous: Date | null,
  lang: string,
) => string;
```

### Built-in view modes (`DEFAULT_VIEW_MODES`)

Exact values from `src/defaults.js`. Where `column_width` is blank, the global
default applies. `upper_text` and `lower_text` are functions unless a quoted
format string is shown.

| Name | `step` | `padding` | `column_width` | `snap_at` | `thick_line` rule | `date_format` | `upper_text_frequency` |
|------|:------:|:---------:|:--------------:|:---------:|-------------------|---------------|:----------------------:|
| Hour | `1h` | `7d` | (default) | — | — | `YYYY-MM-DD HH:` | 24 |
| Quarter Day | `6h` | `7d` | (default) | — | — | `YYYY-MM-DD HH:` | 4 |
| Half Day | `12h` | `14d` | (default) | — | — | `YYYY-MM-DD HH:` | 2 |
| Day | `1d` | `7d` | (default) | — | Mondays (`getDay() === 1`) | `YYYY-MM-DD` | — |
| Week | `7d` | `1m` | `140` | — | first week of month (`date 1–7`) | `YYYY-MM-DD` | 4 |
| Month | `1m` | `2m` | `120` | `7d` | quarter starts (`month % 3 === 0`) | `YYYY-MM` | — |
| Year | `1y` | `2y` | `120` | `30d` | — | `YYYY` | — |

Upper / lower text behavior per mode:

| Name | Lower text (per column) | Upper text (grouping) |
|------|-------------------------|-----------------------|
| Hour | `HH` | day, as `D MMMM`, only when the day changes |
| Quarter Day | `HH` | day, as `D MMM`, only when the day changes |
| Half Day | `HH` | day, as `D` (or `D MMM`), only when the day changes |
| Day | `D`, only when the day changes | `MMMM`, only when the month changes |
| Week | week range (`formatWeek`, e.g. `1 Jun - 7`) | `MMMM`, only when the month changes |
| Month | `MMMM` | `YYYY`, only when the year changes |
| Year | `YYYY` | decade (e.g. `2020`), only when the decade changes |

> `formatWeek(d, ld, lang)` renders `"<start> - <end>"`, appending `MMM` to a
> side only when that side crosses a month boundary.

---

## 5. `GanttOptions`

The new public options object. Rendering/behavior options are flat `camelCase`;
the table-integration seams are grouped under `table`, and readonly flags under
`readonly`. (For the prose explanation of each option, see [`API.md`](./API.md).)

```ts
export interface GanttOptions {
  /** Initial task list. */
  tasks?: Task[];

  // ── view / scale ──────────────────────────────────────────────
  /** Active view-mode name (default `"Day"`). */
  viewMode?: string;
  /** Available view modes (defaults to the 7 built-ins). */
  viewModes?: ViewMode[];
  /** Show the built-in view-mode `<select>` (default `false`). */
  viewModeSelect?: boolean;
  /** Global column width override (px). Falls back to the mode's value. */
  columnWidth?: number | null;
  /** Default snap granularity; per-mode `snap_at` overrides (default `null`). */
  snapAt?: Duration | null;
  /** Auto-extend the timeline as the user scrolls (default `true`). */
  infinitePadding?: boolean;
  /** Initial scroll target: `"today"` or a date (default `"today"`). */
  scrollTo?: 'today' | DateInput;

  // ── geometry / rendering ─────────────────────────────────────
  /** Bar height in px (default `30`). */
  barHeight?: number;
  /** Bar corner radius in px (default `3`). */
  barCornerRadius?: number;
  /** Vertical row padding added to `barHeight` for default row height (default `18`). */
  padding?: number;
  /** Vertical offset of the progress bar within the bar. */
  progressBarPadding?: number;
  /** Container height: a px number or `"auto"` (default `"auto"`). */
  containerHeight?: number | 'auto';
  /** Upper header height in px (default `45`). */
  upperHeaderHeight?: number;
  /** Lower header height in px (default `30`). */
  lowerHeaderHeight?: number;
  /** Grid lines: `"both" | "vertical" | "horizontal" | "none"` (default `"both"`). */
  lines?: 'both' | 'vertical' | 'horizontal' | 'none';
  /** Dependency-arrow curve radius in px (default `5`). */
  arrowCurve?: number;
  /** Default date format string (default `"YYYY-MM-DD HH:mm"`). */
  dateFormat?: string;
  /** Locale for `Intl` month/day names (default `"en"`). */
  language?: string;

  // ── overlays / chrome buttons ────────────────────────────────
  /** Show expected-progress overlay (default `false`). */
  showExpectedProgress?: boolean;
  /** Show expected-date baseline line (default `false`). */
  expectedDateLine?: boolean;
  /** Show the "Today" button (default `true`). */
  todayButton?: boolean;
  /** Show the expected-line toggle button (default `false`). */
  expectedLineButton?: boolean;
  /** Reflow bar labels on horizontal scroll (default `false`). */
  autoMoveLabel?: boolean;

  // ── popup ─────────────────────────────────────────────────────
  /** Custom popup renderer, or `false` to disable. */
  popup?: ((ctx: PopupContext) => void) | false;
  /** Popup trigger: `"click"` or `"hover"` (default `"click"`). */
  popupOn?: 'click' | 'hover';

  // ── behavior ──────────────────────────────────────────────────
  /** Move dependent tasks when dragging a predecessor (default `true`). */
  moveDependencies?: boolean;

  // ── readonly flags (grouped) ─────────────────────────────────
  /**
   * Read-only behavior. `true` locks everything; the object form locks
   * individual gestures. (Maps to the legacy flat `readonly`,
   * `readonly_dates`, `readonly_progress`, `readonly_dependency`.)
   */
  readonly?:
    | boolean
    | {
        all?: boolean;
        dates?: boolean;       // disable move + resize
        progress?: boolean;    // disable progress drag
        dependencies?: boolean;// disable dependency creation
      };

  // ── time exclusion / holidays ────────────────────────────────
  /** Holiday/weekend highlight configuration. @see HolidaysConfig */
  holidays?: HolidaysConfig;
  /** Dates/predicate to exclude from progress & dragging. @see IgnoreConfig */
  ignore?: IgnoreConfig;

  // ── integration & extensibility ──────────────────────────────
  /** Host-table integration seams. @see TableIntegrationOptions */
  table?: TableIntegrationOptions;
  /** Plugins (e.g. the label-panel plugin). */
  plugins?: GanttPlugin[];
}

/** Minimal plugin contract (see PLUGINS.md). */
export interface GanttPlugin {
  readonly name: string;
  install(ctx: PluginContext): void;
  destroy(): void;
}
```

> **Events are not options.** Unlike the legacy API (`on_date_change`,
> `on_create_dependency`, `on_arrow_rclick`, …), the new API has **no `on_*`
> option keys** — subscribe via `gantt.on(event, handler)`. See
> [`GanttEventMap`](#8-gantteventmap) and [`EVENTS.md`](./EVENTS.md).

---

## 6. `TableIntegrationOptions`

The library's differentiator: binding the chart into a single full-height cell
of a host-owned table. These three+1 seams are made explicit here. See
[`INTEGRATION.md`](./INTEGRATION.md) for the host recipe.

```ts
export interface TableIntegrationOptions {
  /**
   * Sticky node to render the timeline header into, **detached** from the chart
   * body (so it can live in the host's own sticky thead). A CSS selector or an
   * element. If the selector doesn't resolve, the chart warns and falls back to
   * rendering the header inline.
   */
  headerMount?: string | HTMLElement;

  /**
   * Host-owned scroll container. The chart delegates vertical (and synchronizes
   * horizontal) scrolling to this element instead of owning its own scrollbar,
   * and uses it to drive `infinitePadding` extension. A CSS selector or element.
   */
  scrollElement?: string | HTMLElement;

  /**
   * Seed per-row heights by task id (px). Invalid (non-finite / non-positive)
   * entries are skipped with a warning. Values persist across `setTasks`.
   * Equivalent to the legacy `row_heights` option.
   */
  rowHeights?: Record<string, number>;

  /**
   * Optional: observe a host element's rows (via `ResizeObserver`) and push
   * their heights into the chart so gantt rows track the host table. Opt-in;
   * when omitted the host pushes heights manually via `gantt.rows.set(...)`.
   */
  syncRowHeightsFrom?: string | HTMLElement;
}
```

Notes:

- **Effective row height** = `task.row_height` if set, otherwise
  `barHeight + padding`. Bars are vertically centered within their row.
- `headerMount` and `scrollElement` accept either a selector string (resolved
  via `document.querySelector`) or a live `HTMLElement`.
- `rowHeights` / `syncRowHeightsFrom` keys are **task ids** (post-normalization,
  i.e. spaces already converted to underscores).

---

## 7. `Arrow`

A dependency arrow between two rendered bars.

```ts
import type Bar from './bar';

export interface Arrow {
  /** Source (predecessor) bar; `from_task.task` is the underlying Task. */
  from_task: Bar;
  /** Target (successor) bar; `to_task.task` is the underlying Task. */
  to_task: Bar;
  /** The arrow's SVG path element. */
  element: SVGPathElement;
  /** The `d` attribute currently applied to `element`. */
  path: string;
}
```

> The `arrow-rclick` event payload carries an `Arrow`; the host typically reads
> `arrow.from_task.task.id` and `arrow.to_task.task.id` to build a context menu.

---

## 8. `GanttEventMap`

The typed event map for `gantt.on(name, handler)` / `gantt.off` / `gantt.once`.
Full payload semantics and emission timing are in [`EVENTS.md`](./EVENTS.md).

```ts
/** Which gesture produced a date change. */
export type GestureSource =
  | 'drag'
  | 'resize-left'
  | 'resize-right'
  | 'progress';

export interface GanttEventMap {
  /** Bar moved or resized; start/end are the new Dates. */
  'date-change': { task: Task; start: Date; end: Date; source: GestureSource };

  /** Progress handle dragged; `progress` is 0–100. */
  'progress-change': { task: Task; progress: number };

  /** Drag-to-connect completed between two bars (task ids). */
  'create-dependency': { from: string; to: string };

  /** Mousedown on a dependency handle (start of a connect gesture). */
  'dependency-handle-mousedown': { task: Task; placement: 'left' | 'right' };

  /** Right-click on an existing arrow (host shows a context menu). */
  'arrow-rclick': { event: PointerEvent; arrow: Arrow };

  /** View mode switched. */
  'view-change': { mode: ViewMode };

  /** Bar single-click. */
  'click': { task: Task };

  /** Bar double-click. */
  'dblclick': { task: Task };

  /** Pointer hover over a bar. */
  'hover': { task: Task; screenX: number; screenY: number; event: PointerEvent };

  /** Any row-height change (set / update / reset / host sync). */
  'row-heights-change': { heights: Record<string, number> };
}

export type GanttEventName = keyof GanttEventMap;
```

Typed subscription signature:

```ts
declare function on<K extends GanttEventName>(
  name: K,
  handler: (payload: GanttEventMap[K]) => void,
): void;
```

> **Legacy mapping:** `on_date_change → 'date-change'`,
> `on_progress_change → 'progress-change'`,
> `on_create_dependency → 'create-dependency'`,
> `on_arrow_rclick → 'arrow-rclick'`,
> `on_view_change → 'view-change'`,
> `on_dependency_handle_mousedown → 'dependency-handle-mousedown'`.
> The legacy `left_resizing_end` / `right_resizing_end` / `dragging_end`
> distinction is folded into `date-change`'s `source` field.

---

## 9. Holidays & ignore config

### `HolidaysConfig`

A dictionary keyed by **CSS color** (a literal color or a `var(--…)` custom
property). Each value selects which dates get highlighted in that color:

- `'weekend'` — Saturdays and Sundays.
- An **array** of dates / predicates / labeled entries.
- A single labeled `{ date, label }` entry (when a `name` key is present).

```ts
/** Map of CSS color → which dates to highlight in that color. */
export type HolidaysConfig = Record<string, HolidayRule>;

export type HolidayRule =
  | 'weekend'                       // Sat & Sun
  | HolidayEntry[]                  // mixed list (see below)
  | { date: string; label: string };// single labeled holiday

/** One entry inside a HolidayRule array. */
export type HolidayEntry =
  | string                          // a date string, e.g. "2026-01-01"
  | ((date: Date) => boolean)       // a predicate
  | { date: string; name: string }; // a labeled date (hover label)
```

Default (from `src/defaults.js`):

```ts
holidays: { 'var(--g-weekend-highlight-color)': 'weekend' }
```

Examples:

```ts
holidays: {
  // weekends in the theme's weekend color
  'var(--g-weekend-highlight-color)': 'weekend',

  // specific labeled holidays in red (label shows on hover)
  '#ffcccc': [
    { date: '2026-01-01', name: "New Year's Day" },
    { date: '2026-07-04', name: 'Independence Day' },
    (d) => d.getMonth() === 11 && d.getDate() === 25, // every Dec 25
  ],
}
```

### `IgnoreConfig`

Dates/spans to exclude from progress math and dragging (the "ignored regions").
Excluded days don't count toward `actual_duration` and are skipped while
computing progress width and snapping.

```ts
/**
 * - "weekend"          → exclude Sat & Sun (installed as a predicate)
 * - (date) => boolean  → custom predicate
 * - string             → a single excluded date ("YYYY-MM-DD")
 * - an array mixing any of the above
 */
export type IgnoreConfig =
  | 'weekend'
  | ((date: Date) => boolean)
  | string
  | Array<'weekend' | ((date: Date) => boolean) | string>;
```

Default: `ignore: []` (nothing excluded).

Internally these resolve into a fast lookup used during render:

| Resolved field | Type | Meaning |
|----------------|------|---------|
| `ignored_dates` | `Date[]` | explicit excluded dates |
| `ignored_function` | `(d: Date) => boolean` | predicate form (e.g. weekend) |
| `ignored_positions` | `number[]` | x-pixel positions of ignored columns |

---

### Cross-references

- Prose options & methods: [`API.md`](./API.md)
- Event payloads & timing: [`EVENTS.md`](./EVENTS.md)
- Table integration recipe: [`INTEGRATION.md`](./INTEGRATION.md)
- Plugin interface: [`PLUGINS.md`](./PLUGINS.md)
- Old → new API map: [`MIGRATION.md`](./MIGRATION.md)
