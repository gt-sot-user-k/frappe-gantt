// Public type definitions for @gts-ui/chart-gantt.
//
// Convention: the public option/method/event API is camelCase / kebab-case,
// while task-data fields stay snake_case (the shape consumers already produce).

/** Accepted date inputs: an ISO-like string or a Date. */
export type DateInput = string | Date;

/**
 * Duration literal, e.g. "7d", "6h", "1m" (m = month), "1y".
 * Mirrors what `date_utils.parse_duration` accepts: y | m | d | h | min | s | ms.
 * Note: minutes use the "min" suffix; "m" means month.
 */
export type Duration =
  | `${number}y`
  | `${number}m`
  | `${number}d`
  | `${number}h`
  | `${number}min`
  | `${number}s`
  | `${number}ms`;

/** Header text formatter for a view-mode column. */
export type DateTextFn = (current: Date, previous: Date | null, lang: string) => string;

/** A single task / row. Data fields stay snake_case (consumer's shape). */
export interface Task {
  id: string;
  name: string;
  start: DateInput;
  end: DateInput;
  progress?: number; // 0..100
  dependencies?: string | string[]; // normalized to string[] by TaskStore
  expected_start?: DateInput;
  expected_end?: DateInput;
  description?: string;
  custom_class?: string;
  color?: string;
  color_progress?: string;
  thumbnail?: string;
  row_height?: number; // px; overrides the default for this row
  invalid?: boolean;
  // computed/internal (set by TaskStore; treat as read-only):
  _index?: number;
  _start?: Date;
  _end?: Date;
  actual_duration?: number;
  ignored_duration?: number;
}

export interface ViewMode {
  name: string;
  step: Duration;
  padding: Duration;
  date_format: string;
  lower_text: string | DateTextFn;
  upper_text?: string | DateTextFn;
  column_width?: number;
  upper_text_frequency?: number;
  thick_line?: (d: Date) => boolean;
  snap_at?: Duration;
}

/** holidays: CSS color -> 'weekend' | list of dates/labels | predicate. */
export type Holidays = Record<
  string,
  | 'weekend'
  | Array<string | Date | { date: string | Date; label?: string }>
  | ((d: Date) => boolean)
>;

export type IgnoreConfig =
  | 'weekend'
  | Array<string | Date | 'weekend'>
  | ((d: Date) => boolean);

export interface ReadonlyOptions {
  all?: boolean;
  dates?: boolean;
  progress?: boolean;
  dependencies?: boolean;
}

export interface TableIntegrationOptions {
  headerMount?: string | HTMLElement;
  scrollElement?: string | HTMLElement;
  rowHeights?: Record<string, number>;
  syncRowHeightsFrom?: string | HTMLElement;
  progressBarPadding?: number;
}

export interface GanttOptions {
  tasks?: Task[];
  viewMode?: string;
  viewModes?: ViewMode[];
  barHeight?: number;
  barCornerRadius?: number;
  padding?: number;
  columnWidth?: number | null;
  containerHeight?: number | 'auto';
  upperHeaderHeight?: number;
  lowerHeaderHeight?: number;
  dateFormat?: string;
  language?: string;
  lines?: 'both' | 'vertical' | 'horizontal' | 'none';
  snapAt?: Duration | null;
  arrowCurve?: number;
  infinitePadding?: boolean;
  moveDependencies?: boolean;
  autoMoveLabel?: boolean;
  scrollTo?: 'today' | 'start' | 'end' | DateInput | null;
  holidays?: Holidays;
  ignore?: IgnoreConfig;
  showExpectedProgress?: boolean;
  expectedDateLine?: boolean;
  todayButton?: boolean;
  viewModeSelect?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  popup?: ((ctx: any) => string | false | void) | false;
  popupOn?: 'click' | 'hover';
  readonly?: boolean | ReadonlyOptions;
  table?: TableIntegrationOptions;
  // GanttPlugin[] — typed in the plugin stage to avoid a forward dependency here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins?: any[];
}

/** A rendered dependency arrow. (Bar is defined in the render stage.) */
export interface Arrow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from_task: any; // Bar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  to_task: any; // Bar
  element: SVGPathElement;
}

export type GestureSource = 'drag' | 'resize-left' | 'resize-right' | 'progress';

/** The typed public event map carried by the EventBus. */
export interface GanttEventMap {
  'date-change': { task: Task; start: Date; end: Date; source: GestureSource };
  'dragging-end': { task: Task };
  'resize-left-end': { task: Task };
  'resize-right-end': { task: Task };
  'progress-change': { task: Task; progress: number };
  click: { task: Task };
  'double-click': { task: Task };
  hover: { task: Task; screenX: number; screenY: number; event: PointerEvent };
  'create-dependency': { from: string; to: string };
  'dependency-handle-mousedown': { task: Task; event: PointerEvent };
  'arrow-rclick': { event: PointerEvent; arrow: Arrow };
  'view-change': { mode: ViewMode };
  'row-heights-change': { heights: Record<string, number> };
}
