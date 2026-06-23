// Default options and built-in view modes, typed.
//
// Option keys are camelCase (the new public API). View-mode definitions are
// ported verbatim from the original `defaults.js` (same values/behaviour).
import dates from '../util/dates';
import type { DateTextFn, GanttOptions, ViewMode } from './types';

function getDecade(d: Date): string {
  const year = d.getFullYear();
  return year - (year % 10) + '';
}

const formatWeek: DateTextFn = (d, ld, lang) => {
  const endOfWeek = dates.add(d, 6, 'day');
  const endFormat = endOfWeek.getMonth() !== d.getMonth() ? 'D MMM' : 'D';
  const beginFormat = !ld || d.getMonth() !== ld.getMonth() ? 'D MMM' : 'D';
  return `${dates.format(d, beginFormat, lang)} - ${dates.format(endOfWeek, endFormat, lang)}`;
};

export const DEFAULT_VIEW_MODES: ViewMode[] = [
  {
    name: 'Hour',
    padding: '7d',
    step: '1h',
    date_format: 'YYYY-MM-DD HH:',
    lower_text: 'HH',
    upper_text: (d, ld, lang) =>
      !ld || d.getDate() !== ld.getDate() ? dates.format(d, 'D MMMM', lang) : '',
    upper_text_frequency: 24,
  },
  {
    name: 'Quarter Day',
    padding: '7d',
    step: '6h',
    date_format: 'YYYY-MM-DD HH:',
    lower_text: 'HH',
    upper_text: (d, ld, lang) =>
      !ld || d.getDate() !== ld.getDate() ? dates.format(d, 'D MMM', lang) : '',
    upper_text_frequency: 4,
  },
  {
    name: 'Half Day',
    padding: '14d',
    step: '12h',
    date_format: 'YYYY-MM-DD HH:',
    lower_text: 'HH',
    upper_text: (d, ld, lang) =>
      !ld || d.getDate() !== ld.getDate()
        ? d.getMonth() !== d.getMonth()
          ? dates.format(d, 'D MMM', lang)
          : dates.format(d, 'D', lang)
        : '',
    upper_text_frequency: 2,
  },
  {
    name: 'Day',
    padding: '7d',
    date_format: 'YYYY-MM-DD',
    step: '1d',
    lower_text: (d, ld, lang) =>
      !ld || d.getDate() !== ld.getDate() ? dates.format(d, 'D', lang) : '',
    upper_text: (d, ld, lang) =>
      !ld || d.getMonth() !== ld.getMonth() ? dates.format(d, 'MMMM', lang) : '',
    thick_line: (d) => d.getDay() === 1,
  },
  {
    name: 'Week',
    padding: '1m',
    step: '7d',
    date_format: 'YYYY-MM-DD',
    column_width: 140,
    lower_text: formatWeek,
    upper_text: (d, ld, lang) =>
      !ld || d.getMonth() !== ld.getMonth() ? dates.format(d, 'MMMM', lang) : '',
    thick_line: (d) => d.getDate() >= 1 && d.getDate() <= 7,
    upper_text_frequency: 4,
  },
  {
    name: 'Month',
    padding: '2m',
    step: '1m',
    column_width: 120,
    date_format: 'YYYY-MM',
    lower_text: 'MMMM',
    upper_text: (d, ld, lang) =>
      !ld || d.getFullYear() !== ld.getFullYear() ? dates.format(d, 'YYYY', lang) : '',
    thick_line: (d) => d.getMonth() % 3 === 0,
    snap_at: '7d',
  },
  {
    name: 'Year',
    padding: '2y',
    step: '1y',
    column_width: 120,
    date_format: 'YYYY',
    upper_text: (d, ld) => (!ld || getDecade(d) !== getDecade(ld) ? getDecade(d) : ''),
    lower_text: 'YYYY',
    snap_at: '30d',
  },
];

export const DEFAULT_OPTIONS: GanttOptions = {
  arrowCurve: 5,
  autoMoveLabel: false,
  barCornerRadius: 3,
  barHeight: 30,
  containerHeight: 'auto',
  columnWidth: null,
  dateFormat: 'YYYY-MM-DD HH:mm',
  upperHeaderHeight: 45,
  lowerHeaderHeight: 30,
  snapAt: null,
  infinitePadding: true,
  holidays: { 'var(--g-weekend-highlight-color)': 'weekend' },
  ignore: [],
  language: 'en',
  lines: 'both',
  moveDependencies: true,
  padding: 18,
  popupOn: 'click',
  readonly: false,
  scrollTo: 'today',
  showExpectedProgress: false,
  expectedDateLine: false,
  todayButton: true,
  viewMode: 'Day',
  viewModeSelect: false,
  viewModes: DEFAULT_VIEW_MODES,
};
