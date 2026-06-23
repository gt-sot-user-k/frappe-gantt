# Features — `@gts-ui/chart-gantt`

This document catalogues every user-facing UX/UI feature of the library in
**Behavior-Driven Development (BDD)** form. Each feature has a prose description,
the options/API that control it (using the **new camelCase public API** from the
re-architecture spec), and one or more **Gherkin scenarios** that map 1:1 to the
BDD test suite.

> **API naming.** Scenarios use the new public API (`new Gantt(el, { tasks, ... })`,
> `setTasks`, `setViewMode`, `on('date-change', …)`, `gantt.rows.*`,
> `table.headerMount` / `table.scrollElement` / `table.rowHeights`). The legacy
> `snake_case` options and `on_*` callbacks still ship for one major version; the
> exhaustive old→new mapping lives in [./MIGRATION.md](./MIGRATION.md). Task **data**
> fields (`expected_start`, `row_height`, `custom_class`, …) keep their original
> names because they are produced by the host.

**Related docs:** [./API.md](./API.md) · [./EVENTS.md](./EVENTS.md) ·
[./INTEGRATION.md](./INTEGRATION.md) · [./PLUGINS.md](./PLUGINS.md) ·
[./DATA-MODEL.md](./DATA-MODEL.md) · [./ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Table of Contents

### Timeline & Navigation
1. [Timeline Views](#1-timeline-views)
2. [View Switching](#2-view-switching)
11. [Current-Date Highlight & Today](#11-current-date-highlight--today)
12. [Infinite Padding](#12-infinite-padding)

### Tasks & Editing
3. [Task Bars](#3-task-bars)
4. [Drag to Move](#4-drag-to-move)
5. [Resize](#5-resize)
6. [Progress Editing](#6-progress-editing)
7. [Expected Progress & Expected Date Line](#7-expected-progress--expected-date-line)
16. [Readonly Modes](#16-readonly-modes)
17. [Custom Row Heights](#17-custom-row-heights)

### Dependencies
8. [Dependencies, Drag-to-Connect & Arrow Right-Click](#8-dependencies-drag-to-connect--arrow-right-click)

### Calendar & Highlights
9. [Holidays & Weekends](#9-holidays--weekends)
10. [Ignored Regions](#10-ignored-regions)

### Presentation
13. [Popup / Tooltip](#13-popup--tooltip)
14. [Theme](#14-theme)
15. [Internationalization (i18n)](#15-internationalization-i18n)

### Integration & Extensibility
18. [Label Side-Panel Plugin](#18-label-side-panel-plugin)
19. [Table Integration](#19-table-integration)

---

# Timeline & Navigation

## 1. Timeline Views

**What it is.** The chart renders a horizontal timeline divided into columns. Each
**view mode** defines the unit and granularity of those columns — from `Hour`
through `Year` — controlling column width, the upper/lower header text for each
column, and which gridlines are drawn "thick" (e.g. Mondays in Day view, quarter
starts in Month view). Seven view modes ship by default: **Hour, Quarter Day,
Half Day, Day, Week, Month, Year**.

**Options / API**

- `viewMode` — the initial view mode by name (default `'Day'`).
- `viewModes` — the array of available view-mode definitions (defaults to the
  seven built-ins). Each definition has `name`, `step`, `padding`, `date_format`,
  `lower_text`, `upper_text`, `upper_text_frequency`, `thick_line`, optional
  `column_width` and `snap_at`.
- `columnWidth` — overrides the per-mode column width for all modes.
- `Gantt.VIEW_MODE` — static constants for the built-in modes.

```gherkin
Feature: Timeline views

  Scenario: Render the default Day view
    Given tasks spanning 2016-12-28 to 2016-12-31
    When a Gantt is created with viewMode "Day"
    Then each timeline column is one day wide
    And the lower header shows the day-of-month for each column
    And the upper header shows the month name when the month changes
    And gridlines on Mondays are rendered thick

  Scenario: Each built-in view mode has its own column width
    Given a Gantt with the default view modes
    When the view mode is "Week"
    Then the column width is 140px
    When the view mode is "Month"
    Then the column width is 120px
    When the view mode is "Day"
    Then the column width is 45px

  Scenario: Year view groups columns by decade in the upper header
    Given tasks spanning 2019 to 2022
    When a Gantt is created with viewMode "Year"
    Then each column is one year wide
    And the lower header shows the four-digit year
    And the upper header shows the decade only when the decade changes

  Scenario: A custom view mode is honored
    Given a viewModes array containing a mode named "Sprint" with step "14d"
    When a Gantt is created with viewMode "Sprint"
    Then columns are spaced two weeks apart
    And the headers use the mode's lower_text and upper_text functions

  Scenario: columnWidth overrides the per-mode width
    Given a Gantt in "Week" view whose default column width is 140px
    When the option columnWidth is set to 200
    Then every column is rendered 200px wide
```

---

## 2. View Switching

**What it is.** The user can move between view modes at runtime. The library can
render a built-in dropdown selector, and the host can drive switching
programmatically (e.g. `susp-frontend` steps the scale with ctrl+wheel). When the
mode changes the chart **preserves the horizontal scroll position** so the user's
focus on a date is not lost, and emits a `view-change` event.

**Options / API**

- `viewModeSelect` — when `true`, renders a `<select>` in the side header.
- `gantt.setViewMode(name)` — programmatic switch (replaces `change_view_mode`).
- `on('view-change', ({ mode }) => …)` — fires after the switch.

```gherkin
Feature: View switching

  Scenario: Switch view via the dropdown
    Given a Gantt with viewModeSelect true, currently in "Day" view
    When the user selects "Week" from the view-mode dropdown
    Then the timeline re-renders in Week view
    And a "view-change" event is emitted with mode.name "Week"

  Scenario: Programmatic switch preserves scroll position
    Given a Gantt scrolled so that 2024-06-15 is centered
    When setViewMode("Month") is called
    Then the chart re-renders in Month view
    And the previous horizontal scroll offset is restored

  Scenario: Switching emits view-change exactly once
    Given a Gantt in "Day" view
    When setViewMode("Year") is called
    Then exactly one "view-change" event is emitted
    And its payload mode.name equals "Year"

  Scenario: Host-driven step (ctrl+wheel) cycles scales
    Given a Gantt embedded by a host that maps ctrl+wheel to setViewMode
    When the user ctrl-scrolls up over the chart
    Then the host calls setViewMode with the next-coarser mode
    And the focused date remains centered after re-render
```

---

## 11. Current-Date Highlight & Today

**What it is.** "Now" is marked with a vertical highlight line spanning the grid
plus a small "ball" indicator on the header, and the matching header column is
flagged `current-date-highlight`. A **Today** button (and `scrollTo: 'today'`)
recenters the viewport on the current date. If today falls outside the rendered
range the grid is first extended so today can be shown.

**Options / API**

- `todayButton` — render the "Today" button in the side header (default `true`).
- `scrollTo` — initial scroll target: `'today'` (default), `'start'`, `'end'`, or
  a date string.
- `gantt.scrollToToday()` — programmatic recenter (replaces `scroll_current`).

```gherkin
Feature: Current-date highlight and Today

  Scenario: Today is highlighted on render
    Given a Gantt whose range includes today
    When the chart renders
    Then a vertical current-highlight line is drawn at today's x position
    And a current-ball-highlight marker is drawn on the header
    And today's header column has the "current-date-highlight" class

  Scenario: Today button recenters the viewport
    Given a Gantt scrolled far away from today
    When the user clicks the "Today" button
    Then the viewport scrolls smoothly so today is centered

  Scenario: scrollTo "today" on construction
    Given tasks whose range includes the current date
    When a Gantt is created with scrollTo "today"
    Then the initial viewport is centered on today

  Scenario: Scroll-to-today when today is out of the rendered range
    Given a Gantt whose rendered range ends before today
    When scrollToToday() is called
    Then the grid is extended to include today (±7 days)
    And the chart re-renders preserving label-panel state
    And the viewport centers on today

  Scenario: todayButton false hides the control
    Given a Gantt created with todayButton false
    Then no "Today" button is present in the side header
```

---

## 12. Infinite Padding

**What it is.** Rather than rendering a fixed padded range, the timeline can
**auto-extend** as the user scrolls toward an edge. When the body is scrolled to
its top/bottom (via wheel), the chart grows the date range by a fixed unit count,
re-renders, and compensates scroll position so bars do not visually jump. This is
the default behavior.

**Options / API**

- `infinitePadding` — enable auto-extension (default `true`). When `false`, the
  active view mode's `padding` is applied as a fixed range on each side.

```gherkin
Feature: Infinite padding

  Scenario: Timeline extends when scrolling up at the top
    Given a Gantt with infinitePadding true scrolled to the top
    When the user scrolls up with the wheel
    Then the gantt start date moves earlier by the extend unit
    And the chart re-renders with the wider range
    And scroll position is compensated so bars do not jump

  Scenario: Timeline extends when scrolling down at the bottom
    Given a Gantt with infinitePadding true scrolled to the bottom
    When the user scrolls down with the wheel
    Then the gantt end date moves later by the extend unit
    And the chart re-renders without the bars jumping horizontally

  Scenario: Fixed padding when infinitePadding is disabled
    Given a Gantt created with infinitePadding false in "Day" view
    Then the range is padded by the view mode's padding ("7d") on each side
    And scrolling past the edge does not extend the range

  Scenario: Extension preserves label-panel state
    Given a Gantt with an open label panel and infinitePadding true
    When the timeline auto-extends on scroll
    Then the label panel remains open with its column selection intact
```

---

# Tasks & Editing

## 3. Task Bars

**What it is.** Each task renders as a rounded SVG bar positioned by its start/end
dates and **vertically centered** in its row. The bar carries a label, an optional
thumbnail image, an inner progress fill, optional custom color/class, and is
marked invalid when its data is bad. Labels sit centered inside the bar when they
fit; when a label is wider than the bar it gets the `big` class and is drawn
beside the bar. With `autoMoveLabel`, labels reflow as the user scrolls so they
stay visible.

**Options / API**

- `barHeight` — bar height in px (default `30`).
- `barCornerRadius` — corner radius (default `3`).
- `autoMoveLabel` — reflow labels on horizontal scroll (default `false`).
- Task data: `name`, `color`, `color_progress`, `custom_class`, `thumbnail`,
  `progress`.

```gherkin
Feature: Task bars

  Scenario: Draw a bar for a task
    Given a task "Design" from 2024-01-01 to 2024-01-05 with progress 40
    When the chart renders
    Then a bar rect is drawn at the task's x position with the computed width
    And a progress fill covers 40% of the (non-ignored) bar width
    And the label "Design" is shown

  Scenario: Label sits inside the bar when it fits
    Given a task whose label is narrower than its bar
    Then the label is centered horizontally within the bar
    And the label does not have the "big" class

  Scenario: Wide label is drawn beside the bar
    Given a task whose label is wider than its bar
    Then the label receives the "big" class
    And the label is positioned just to the right of the bar end

  Scenario: Custom color and class are applied
    Given a task with color "#ff0000" and custom_class "milestone"
    Then the bar fill is "#ff0000"
    And the bar wrapper carries the "milestone" class

  Scenario: Thumbnail is rendered and clipped
    Given a task with a thumbnail URL
    Then a clipped image is drawn at the start of the bar
    And the label is shifted to the right of the thumbnail

  Scenario: Invalid task is marked
    Given a task flagged invalid
    Then its bar has the "bar-invalid" class
    And it draws no progress bar and no edit handles

  Scenario: autoMoveLabel keeps the label visible while scrolling
    Given a Gantt with autoMoveLabel true and a wide bar
    When the user scrolls horizontally
    Then a non-"big" label shifts to remain within the viewport-visible part of the bar
```

---

## 4. Drag to Move

**What it is.** The user drags a bar's body to reschedule a task. Movement
**snaps** to the configured granularity, **skips ignored regions** (weekends/
holidays) so a bar never lands on excluded columns, and — when `moveDependencies`
is on — moves dependent tasks together. On release a `date-change` event fires
with the new start/end.

**Options / API**

- `snapAt` — snap granularity (e.g. `'1d'`, `'unit'`); falls back to the view
  mode's `snap_at` then `'1d'`.
- `moveDependencies` — move dependents with the dragged task (default `true`).
- Blocked by `readonly` and `readonly.dates`.
- `on('date-change', ({ task, start, end, source }) => …)` — `source` is `'drag'`.

```gherkin
Feature: Drag to move a task

  Scenario: Drag snaps to the day grid
    Given a Gantt in "Day" view with snapAt "1d"
    And a task starting on 2024-01-03
    When the user drags the bar right by about 1.6 columns
    Then the bar lands snapped to a whole-day boundary
    And on release a "date-change" event fires with source "drag"

  Scenario: Dragging skips an ignored region
    Given ignore includes "weekend"
    And a task whose drag target would land on a Saturday column
    When the user drags the bar onto the weekend
    Then the bar is pushed past the ignored columns to the next valid column

  Scenario: Moving a task moves its dependents
    Given moveDependencies is true
    And task B depends on task A
    When the user drags task A forward by 2 days
    Then task B moves forward by the same amount
    And a "date-change" event fires for the moved tasks

  Scenario: moveDependencies false leaves dependents in place
    Given moveDependencies is false
    And task B depends on task A
    When the user drags task A
    Then task B does not move

  Scenario: Dragging is blocked in readonly dates mode
    Given a Gantt created with readonly { dates: true }
    When the user attempts to drag a bar
    Then the bar does not move
    And no "date-change" event is emitted
```

---

## 5. Resize

**What it is.** Each editable bar exposes left and right resize handles. Dragging
the **right** handle changes the end date; dragging the **left** handle changes the
start date (moving x and adjusting width). Resizing snaps like dragging and emits
`date-change` with the corresponding `source`.

**Options / API**

- `snapAt` — snap granularity (shared with drag).
- Handles are suppressed by `readonly` and `readonly.dates`.
- `on('date-change', …)` — `source` is `'resize-left'` or `'resize-right'`.

```gherkin
Feature: Resize a task

  Scenario: Resize the end date with the right handle
    Given an editable task bar in "Day" view
    When the user drags the right handle two columns to the right
    Then the bar width increases by two days (snapped)
    And a "date-change" event fires with source "resize-right"

  Scenario: Resize the start date with the left handle
    Given an editable task bar
    When the user drags the left handle one column to the left
    Then the bar's x moves left and its width grows by one day
    And a "date-change" event fires with source "resize-left"

  Scenario: Resize honors the snap granularity
    Given a Gantt in "Month" view whose snap_at is "7d"
    When the user resizes a bar by a few days
    Then the new edge snaps to a 7-day boundary

  Scenario: Resize handles are hidden when dates are readonly
    Given a Gantt with readonly { dates: true }
    Then no left/right resize handles are drawn on bars

  Scenario: Resize handles are hidden when fully readonly
    Given a Gantt with readonly true
    Then no resize handles and no progress handle are drawn
```

---

## 6. Progress Editing

**What it is.** Each editable bar has a circular progress handle at the end of its
progress fill. Dragging it left/right sets the task's completion percentage.
Progress math **excludes ignored regions** (a weekend inside the bar does not
count toward "100%"). On release a `progress-change` event fires. Clicking near
the handle does not trigger the popup. Disabled by `readonly.progress`.

**Options / API**

- `readonly.progress` (legacy `readonly_progress`) — disable progress editing.
- `readonly` — disables everything including progress.
- `on('progress-change', ({ task, progress }) => …)`.

```gherkin
Feature: Progress editing

  Scenario: Drag the progress handle to set completion
    Given an editable task bar at 20% progress
    When the user drags the progress handle to the bar midpoint
    Then the progress fill grows to about 50%
    And on release a "progress-change" event fires with the new value

  Scenario: Progress cannot exceed the bar bounds
    Given a progress handle at the bar end
    When the user drags it further right
    Then the progress fill is clamped to 100% of the bar
    When the user drags it past the bar start
    Then the progress fill is clamped to 0%

  Scenario: Progress excludes ignored columns
    Given a bar that spans a weekend with ignore "weekend"
    When progress is dragged across the weekend columns
    Then the ignored columns are not counted in the progress percentage

  Scenario: Progress editing is disabled in readonly progress mode
    Given a Gantt with readonly { progress: true }
    Then no progress handle is drawn
    And the progress value cannot be changed by the user

  Scenario: Clicking the progress handle does not open the popup
    Given popupOn "click" and an editable bar
    When the user releases the pointer over the progress handle
    Then the task popup is not shown
```

---

## 7. Expected Progress & Expected Date Line

**What it is.** For tasks carrying `expected_start`/`expected_end`, the chart can
overlay (a) an **expected-progress** bar showing where progress *should* be given
today's date, and (b) an **expected date line** drawn beneath the bar between the
expected start and end. A toggle button can show/hide the expected lines for all
tasks at once. Dragging a bar earlier than its expected start is prevented when an
expected start exists.

**Options / API**

- `showExpectedProgress` — draw the expected-progress overlay (default `false`).
- `expectedDateLine` — draw the expected line under bars (default `false`).
- `expectedLineButton` — render an "Expected" toggle button (default `false`).
- Task data: `expected_start`, `expected_end`.

```gherkin
Feature: Expected progress and expected date line

  Scenario: Expected progress overlay reflects elapsed time
    Given a task with start, end, and showExpectedProgress true
    When the chart renders
    Then an expected-progress bar is drawn proportional to elapsed duration

  Scenario: Expected date line is drawn for tasks with expected dates
    Given expectedDateLine true
    And a task with expected_start and expected_end
    Then a line is drawn under the bar from expected_start x to expected_end x

  Scenario: Expected line is omitted when a task lacks expected dates
    Given expectedDateLine true
    And a task without expected_start/expected_end
    Then no expected line is drawn for that task

  Scenario: Toggle button shows and hides expected lines
    Given expectedLineButton true and expectedDateLine false
    When the user clicks the "Expected" button
    Then expected lines appear for all tasks with expected dates
    When the user clicks "Expected" again
    Then all expected lines are removed

  Scenario: A bar cannot be dragged before its expected start
    Given a task with an expected_start and an existing bar
    When the user drags the bar earlier than the expected start x
    Then the move is rejected and the bar stays at/after expected start
```

---

## 16. Readonly Modes

**What it is.** Editing can be disabled globally or per-capability. `readonly`
disables everything (no resize, progress, or dependency handles, and dragging is
blocked). The granular flags disable only dates, progress, or dependency creation,
independently.

**Options / API**

- `readonly` — boolean; disables all editing.
- `readonly.dates` (legacy `readonly_dates`) — disable move + resize.
- `readonly.progress` (legacy `readonly_progress`) — disable progress drag.
- `readonly.dependencies` (legacy `readonly_dependency`) — disable drag-to-connect.

```gherkin
Feature: Readonly modes

  Scenario: Fully readonly chart has no edit affordances
    Given a Gantt with readonly true
    Then bars have no resize handles, no progress handle, and no dependency handles
    And dragging a bar does not change its dates

  Scenario: Readonly dates blocks move and resize only
    Given a Gantt with readonly { dates: true }
    Then resize handles are hidden and dragging is blocked
    But the progress handle remains and progress can still be edited

  Scenario: Readonly progress blocks progress editing only
    Given a Gantt with readonly { progress: true }
    Then the progress handle is hidden
    But the bar can still be dragged and resized

  Scenario: Readonly dependencies blocks drag-to-connect only
    Given a Gantt with readonly { dependencies: true }
    Then no dependency handles are drawn
    But dates and progress remain editable

  Scenario: Independent readonly flags compose
    Given a Gantt with readonly { dates: true, progress: true }
    Then neither dates nor progress can be edited
    But dependency creation remains available
```

---

## 17. Custom Row Heights

**What it is.** By default every row is `barHeight + padding` tall. Rows can be
given **custom per-row heights**, keyed by task id, to emphasize tasks or to match
a host table's variable row heights. Bars stay **vertically centered** in their
row, gridlines/highlights/arrows honor the custom heights, and custom heights
**persist across `setTasks`** (re-applied by id to the new task objects). Invalid
heights and unknown ids are warned and skipped — never thrown.

**Options / API**

- `table.rowHeights` (legacy `row_heights`) — seed heights `{ id: px }` at
  construction.
- Task data field `row_height` — per-task override.
- `gantt.rows.set({ id: px })` — bulk set (partial updates allowed).
- `gantt.rows.update(idOrIndex, px)` — single row by id or index.
- `gantt.rows.reset(idOrIndex)` — restore default height for a row.
- `gantt.rows.getAll()` — effective height of every row, keyed by id.
- `on('row-heights-change', ({ heights }) => …)`.
- `rows.set` / `rows.update` are fluent (return the chart for chaining).

```gherkin
Feature: Custom row heights

  Scenario: Seed heights at construction
    Given tasks "task-1" and "task-2"
    When a Gantt is created with table.rowHeights { "task-1": 64, "task-2": 120 }
    Then row "task-1" is 64px tall and row "task-2" is 120px tall
    And each bar is vertically centered within its row

  Scenario: Per-task row_height field is honored
    Given a task "task-1" with row_height 60
    When the chart renders
    Then row "task-1" is 60px tall

  Scenario: Bulk set with partial updates
    Given a rendered Gantt
    When rows.set({ "task-1": 80, "task-3": 96 }) is called
    Then only rows task-1 and task-3 change height
    And the chart re-renders with arrows adjusted to the new heights

  Scenario: Update a single row by index
    Given a rendered Gantt
    When rows.update(0, 72) is called
    Then the first row's height becomes 72px

  Scenario: Reset a row to the default height
    Given row "task-1" has a custom height of 80px
    When rows.reset("task-1") is called
    Then row "task-1" returns to barHeight + padding

  Scenario: Invalid heights are skipped with a warning
    Given a rendered Gantt
    When rows.set({ "task-1": -5, "task-2": "tall", "ghost": 64 }) is called
    Then a console warning is logged for each invalid entry and unknown id
    And no exception is thrown
    And valid rows are still applied

  Scenario: Custom heights persist across setTasks
    Given row "task-1" was set to 80px
    When setTasks is called with a fresh array containing "task-1"
    Then row "task-1" is still 80px without re-sending the height

  Scenario: Re-render preserves label panel and adjusts arrows
    Given an open label panel and dependency arrows
    When a row height changes
    Then the chart re-renders, the label panel stays open
    And dependency arrows re-route to the new bar positions

  Scenario: Fluent chaining
    Given a Gantt instance
    When rows.set({ "task-1": 80 }).update("task-2", 64).reset("task-3") is called
    Then all three operations apply in order
```

---

# Dependencies

## 8. Dependencies, Drag-to-Connect & Arrow Right-Click

**What it is.** Tasks declare dependencies (`dependencies: 'a,b'` or `['a','b']`)
and the chart draws curved arrows from each predecessor bar to its successor. The
user can **create** a dependency by dragging from a bar's dependency handle to
another bar — a "dummy" arrow previews the connection during the drag; on drop a
`create-dependency` event fires. **Right-clicking** an arrow emits `arrow-rclick`
so the host can show a context menu (e.g. to delete the relation). The arrow
corner radius is configurable.

**Options / API**

- Task data: `dependencies` (string `'a,b'` or `string[]`; ids normalized,
  spaces → underscores).
- `arrowCurve` (legacy `arrow_curve`) — arrow corner radius (default `5`).
- `readonly.dependencies` / `readonly` — disable drag-to-connect handles.
- `on('create-dependency', ({ from, to }) => …)`.
- `on('arrow-rclick', ({ event, arrow }) => …)`.

```gherkin
Feature: Dependencies, drag-to-connect and arrow right-click

  Scenario: Arrows are drawn for declared dependencies
    Given task B with dependencies "A"
    When the chart renders
    Then a curved arrow is drawn from bar A to bar B

  Scenario: String dependencies are parsed and normalized
    Given a task with dependencies "task one, task two"
    Then the dependency ids are normalized to "task_one" and "task_two"

  Scenario: Drag-to-connect creates a dependency
    Given two bars A and B with dependency handles
    When the user drags from A's right dependency handle onto B
    Then a dummy arrow previews the connection during the drag
    And on drop a "create-dependency" event fires with { from: "A", to: "B" }

  Scenario: Right-click an arrow for a context menu
    Given an existing dependency arrow
    When the user right-clicks the arrow
    Then an "arrow-rclick" event fires with the pointer event and the arrow

  Scenario: Arrow curve radius is configurable
    Given arrowCurve 10
    Then dependency arrows are drawn with a 10px corner radius

  Scenario: Drag-to-connect is disabled when dependencies are readonly
    Given a Gantt with readonly { dependencies: true }
    Then no dependency handles are drawn
    And no "create-dependency" event can be produced

  Scenario: Transitive dependents are gathered for moves
    Given C depends on B and B depends on A
    When the dependents of A are computed
    Then both B and C are included
```

---

# Calendar & Highlights

## 9. Holidays & Weekends

**What it is.** Calendar days can be **highlighted** with colored vertical bands —
weekends by default, plus arbitrary holiday dates. Holidays are configured as a
map of CSS color → matcher (the string `'weekend'`, an array of date
strings/objects, or `{ date, label }` entries). Named holidays show a **hover
label** when the user mouses over the highlight band.

**Options / API**

- `holidays` — map of CSS color → `'weekend'` | `(Date)=>boolean` |
  array of date strings / `{ date, label }`. Default:
  `{ 'var(--g-weekend-highlight-color)': 'weekend' }`.

```gherkin
Feature: Holidays and weekends

  Scenario: Weekends are highlighted by default
    Given a Gantt with the default holidays option
    Then Saturday and Sunday columns are shaded with the weekend color

  Scenario: Named holiday with a hover label
    Given holidays maps a color to [{ date: "2024-12-25", label: "Christmas" }]
    Then 2024-12-25 is shaded with that color
    When the user hovers the highlighted column
    Then a "Christmas" label appears near the pointer

  Scenario: Custom holiday color
    Given holidays maps "#ffcc00" to ["2024-07-04"]
    Then the 2024-07-04 column is shaded "#ffcc00"

  Scenario: Holidays respect ignored dates
    Given a date that is both an ignored date and a holiday candidate
    Then it is not double-highlighted as a holiday over the ignored hatch
```

---

## 10. Ignored Regions

**What it is.** Distinct from holiday *coloring*, `ignore` marks columns as
**excluded from time math and interaction**: ignored days are not counted toward a
task's actual duration or progress, drawn with a diagonal-hatch overlay, and are
**skipped** when dragging, resizing, or dragging progress (the gesture jumps over
them to the next valid column). `ignore` accepts `'weekend'`, specific dates, or a
predicate function.

**Options / API**

- `ignore` — `'weekend'` | date string | array of those | `(Date)=>boolean`.
  Default `[]`.

```gherkin
Feature: Ignored regions

  Scenario: Ignored days are hatched and excluded from duration
    Given ignore "weekend"
    And a task spanning a weekend
    Then weekend columns show the diagonal-hatch overlay
    And the task's actual_duration excludes the weekend days
    And ignored_duration counts the excluded days

  Scenario: A custom ignore predicate
    Given ignore is a function returning true for every Friday
    Then all Friday columns are hatched and excluded from progress

  Scenario: Dragging jumps over ignored columns
    Given ignore "weekend"
    When a bar is dragged so its snapped target lands inside the weekend
    Then the bar is advanced past the ignored columns to the next valid one

  Scenario: Progress drag jumps over ignored columns
    Given a bar spanning an ignored region
    When the user drags progress across the ignored columns
    Then the handle skips the ignored span rather than stopping inside it

  Scenario: Specific ignored dates
    Given ignore ["2024-01-01", "2024-01-02"]
    Then those two columns are hatched and excluded from time math
```

---

# Presentation

## 13. Popup / Tooltip

**What it is.** A popup shows task details on click or hover. The default renderer
shows the task name, optional description, date range, duration (with excluded
days), and progress. The popup is fully customizable: the `popup` function may
return `false` (no popup), an HTML string (used verbatim), or `undefined` after
mutating the popup via the supplied setters. It can register action buttons.

**Options / API**

- `popupOn` (legacy `popup_on`) — `'click'` (default) or `'hover'`.
- `popup` — `false` to disable, or `(ctx) => string | false | undefined`.
  `ctx` provides `task`, `chart`, `get/set_title`, `get/set_subtitle`,
  `get/set_details`, and `add_action(html, fn)`.

```gherkin
Feature: Popup / tooltip

  Scenario: Default popup on click
    Given a Gantt with popupOn "click"
    When the user clicks a task bar
    Then a popup shows the task name, date range, duration and progress

  Scenario: Popup on hover
    Given a Gantt with popupOn "hover"
    When the user hovers a bar for the hover delay
    Then the popup appears
    When the pointer leaves the bar
    Then the popup hides

  Scenario: Disable the popup entirely
    Given a Gantt with popup set to false
    When the user clicks a bar
    Then no popup is shown

  Scenario: Custom popup returning an HTML string
    Given popup is a function returning "<b>Custom</b>"
    When the popup is shown
    Then its content is exactly the returned HTML

  Scenario: Custom popup mutating sections and adding an action
    Given popup is a function that sets the title and calls add_action
    When the popup is shown
    Then the title reflects the set value
    And an action button is rendered whose click invokes the callback

  Scenario: Popup is hidden during drag and on grid click
    Given a visible popup
    When the user starts dragging a bar
    Then the popup is hidden
    When the user clicks an empty grid row
    Then the popup is hidden
```

---

## 14. Theme

**What it is.** A built-in theme toggle in the header cycles **Auto → Light →
Dark**. Auto follows the OS `prefers-color-scheme`; Light/Dark force the scheme.
The theme applies consistent colors to bars, gridlines, text, backgrounds and
controls via CSS custom properties.

**Options / API**

- Theme toggle is rendered by the header controls; colors derive from CSS custom
  properties (e.g. `--g-weekend-highlight-color`), so a host can re-theme by
  overriding variables.

```gherkin
Feature: Theme

  Scenario: Auto theme follows the system preference
    Given the theme is set to Auto
    And the OS prefers a dark color scheme
    Then the chart renders with dark colors

  Scenario: Cycle through theme modes
    Given the theme toggle is in Auto
    When the user clicks the theme toggle
    Then the theme becomes Light
    When the user clicks it again
    Then the theme becomes Dark
    When the user clicks it again
    Then the theme returns to Auto

  Scenario: Theme applies to all chart elements
    Given the Dark theme is active
    Then bars, gridlines, header text and backgrounds use the dark palette

  Scenario: Host overrides a CSS custom property
    Given the host overrides --g-weekend-highlight-color
    Then weekend highlights use the host-provided color under every theme
```

---

## 15. Internationalization (i18n)

**What it is.** Month and day names in headers and the default popup are localized
using `Intl` based on the `language` option (ISO 639-1). Date *formatting tokens*
(e.g. `MMMM`, `D`) resolve to localized strings.

**Options / API**

- `language` (legacy `language`) — ISO 639-1 code (default `'en'`).

```gherkin
Feature: Internationalization

  Scenario: Localized month names in the header
    Given a Gantt created with language "fr"
    When the chart renders in "Month" view
    Then the upper header shows French month names

  Scenario: Localized day names
    Given a Gantt with language "es"
    Then header day/weekday text uses Spanish localization

  Scenario: Default language is English
    Given a Gantt created without a language option
    Then headers render in English

  Scenario: Custom view-mode text functions receive the language
    Given a view mode whose lower_text is a function
    When the header is built
    Then the function is called with (currentDate, previousDate, language)
```

---

# Integration & Extensibility

## 18. Label Side-Panel Plugin

**What it is.** An optional side panel (extracted to the `LabelPanelPlugin`)
renders task metadata as a small grid of columns beside the timeline. It is
**resizable** by dragging its border (clamped between a minimum and 40% of the
container width), **scroll-synced** vertically with the chart body, and — when
filtering is enabled — lets the user choose which columns to show via a dropdown,
limited to a **maximum of 3** columns at a time. State (visibility, selected
columns, width) is preserved across re-renders.

**Options / API** (under the plugin's namespace; legacy flat options shown for
reference)

- `labels` — array of `{ header: values[] }` objects (each header = a column).
- `labelButton` (legacy `label_button`) — render the "Label" toggle button.
- `labelFilter` (legacy `label_filter`) — enable the column show/hide dropdown
  (max 3 selected). When filtering is off, the first 2 columns are shown.

See [./PLUGINS.md](./PLUGINS.md) for the plugin interface and registration.

```gherkin
Feature: Label side-panel plugin

  Scenario: Toggle the panel with the Label button
    Given a Gantt with labelButton true and labels configured
    When the user clicks the "Label" button
    Then the label panel becomes visible
    When the user clicks "Label" again
    Then the label panel hides

  Scenario: Columns and values align with rows
    Given labels [{ "Status": ["Open","Done"], "Owner": ["Ana","Bo"] }]
    And labelFilter false
    Then the first two columns are shown
    And each value cell height matches its row height (barHeight + padding)

  Scenario: Vertical scroll stays in sync
    Given the label panel is open
    When the user scrolls the chart body down
    Then the label panel scrolls to the same vertical offset
    And vice-versa when the panel is scrolled

  Scenario: Resize the panel within bounds
    Given the label panel is open
    When the user drags the resize handle wider
    Then the panel width grows
    But is clamped to at most 40% of the container width
    And not below the minimum width

  Scenario: Column filter is limited to three selections
    Given labelFilter true and four label columns
    And three columns are already selected
    When the user opens the settings dropdown
    Then the unchecked checkboxes are disabled
    And selecting a fourth column is not possible until one is deselected

  Scenario: Panel state persists across re-render
    Given the panel is open with a custom width and a 3-column selection
    When the chart re-renders (e.g. row height change or infinite-padding extend)
    Then the panel remains open with the same width and the same selected columns

  Scenario: Updating labels rebuilds the open panel
    Given an open label panel
    When the labels data is updated
    Then the panel rebuilds with the new columns and values
```

---

## 19. Table Integration

**What it is.** The library's differentiator: it is a **timeline-only** Gantt
with **no built-in grid/table**. The host supplies its own table and binds the
chart into a single full-height cell via three seams:

1. **Header mount** — the sticky timeline header renders into an external host
   node instead of the chart body.
2. **External scroll** — vertical (and synchronized) scroll is delegated to a
   host-owned scroll container.
3. **Row-height sync** — the chart aligns its bar rows to the host table's row
   heights (seeded and/or observed), keeping bars centered per row.

Domain events (`date-change`, `create-dependency`, `arrow-rclick`,
`progress-change`, `row-heights-change`) let the host persist changes via its own
API.

**Options / API** (grouped under `table`)

- `table.headerMount` (legacy `header_mount`) — selector/element for the sticky
  header node. If not found, the header falls back into the chart body with a
  warning.
- `table.scrollElement` (legacy `scroll_element_selector`) — host scroll
  container; the chart syncs header and body to it.
- `table.rowHeights` (legacy `row_heights`) — seed heights by task id.
- `table.syncRowHeightsFrom` — optional host element whose rows are observed
  (ResizeObserver) and pushed into the row-height model.

See [./INTEGRATION.md](./INTEGRATION.md) for the full host recipe and the
`susp-frontend` example, and [./EVENTS.md](./EVENTS.md) for payloads.

```gherkin
Feature: Table integration

  Scenario: Header renders into an external sticky node
    Given a host element "#gantt-header" exists
    When a Gantt is created with table.headerMount "#gantt-header"
    Then the timeline header is rendered inside "#gantt-header"
    And the header scrolls horizontally in sync with the body

  Scenario: Missing header mount falls back to the body
    Given table.headerMount points to a selector not in the DOM
    When the Gantt is created
    Then a warning is logged
    And the header renders inside the chart body instead

  Scenario: Vertical scroll is delegated to a host container
    Given a host scroll container "#host-scroll"
    When a Gantt is created with table.scrollElement "#host-scroll"
    Then scrolling "#host-scroll" scrolls the chart body
    And the header stays horizontally aligned

  Scenario: Row-height sync from host rows
    Given a chart bound via table.syncRowHeightsFrom to a host table
    When a host row's height changes to 96px
    Then the matching gantt row re-renders at 96px
    And the bar stays vertically centered
    And a "row-heights-change" event is emitted with the new map

  Scenario: Seeded row heights match the host on first render
    Given the host computes its row heights as { "task-1": 64, "task-2": 120 }
    When a Gantt is created with table.rowHeights set to that map
    Then the chart's rows match the host rows on the first paint

  Scenario: Domain events drive host persistence
    Given a host listening for "date-change" and "create-dependency"
    When the user drags a bar and then connects two bars
    Then the host receives "date-change" and "create-dependency"
    And translates each into its own API call
```

---

## Note for implementers

These scenarios are the **source of truth for the BDD test suite**. Each
`Feature`/`Scenario` above maps 1:1 to a
`describe('Feature: …') / it('Scenario: …')` spec (DOM-dependent suites run in the
`jsdom` vitest environment; pure-logic units run in `node` — see the design spec
§5). When behavior changes, update the scenario here first, then the test, then
the implementation. Keep this document and the suite in lockstep.

**Cross-references:** [./API.md](./API.md) (full method/option reference) ·
[./EVENTS.md](./EVENTS.md) (event payloads & timing) ·
[./INTEGRATION.md](./INTEGRATION.md) (table-integration host recipe) ·
[./PLUGINS.md](./PLUGINS.md) (plugin interface & label panel) ·
[./DATA-MODEL.md](./DATA-MODEL.md) · [./MIGRATION.md](./MIGRATION.md).
