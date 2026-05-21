import type { WorkflowState } from '../variable-substitution';

type DatetimeOp = 'format' | 'parse' | 'add' | 'subtract' | 'diff' | 'now';

function resolveDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const d = new Date(value as string | number);
  if (isNaN(d.getTime())) throw new Error(`Cannot parse date: ${value}`);
  return d;
}

function addDuration(date: Date, amount: number, unit: string): Date {
  const d = new Date(date);
  switch (unit) {
    case 'milliseconds': d.setMilliseconds(d.getMilliseconds() + amount); break;
    case 'seconds':      d.setSeconds(d.getSeconds() + amount);           break;
    case 'minutes':      d.setMinutes(d.getMinutes() + amount);           break;
    case 'hours':        d.setHours(d.getHours() + amount);               break;
    case 'days':         d.setDate(d.getDate() + amount);                 break;
    case 'weeks':        d.setDate(d.getDate() + amount * 7);             break;
    case 'months':       d.setMonth(d.getMonth() + amount);               break;
    case 'years':        d.setFullYear(d.getFullYear() + amount);         break;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
  return d;
}

function formatDate(date: Date, format: string): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return format
    .replace('YYYY', String(date.getFullYear()))
    .replace('YY',   String(date.getFullYear()).slice(-2))
    .replace('MM',   pad(date.getMonth() + 1))
    .replace('DD',   pad(date.getDate()))
    .replace('HH',   pad(date.getHours()))
    .replace('mm',   pad(date.getMinutes()))
    .replace('ss',   pad(date.getSeconds()))
    .replace('SSS',  pad(date.getMilliseconds(), 3))
    .replace('ISO',  date.toISOString())
    .replace('UTC',  date.toUTCString())
    .replace('UNIX', String(Math.floor(date.getTime() / 1000)));
}

export function executeDatetimeNode(nodeData: Record<string, any>, state: WorkflowState): unknown {
  const op: DatetimeOp = (nodeData.operation ?? 'now') as DatetimeOp;

  switch (op) {
    case 'now': {
      const fmt: string = nodeData.format ?? 'ISO';
      const d = new Date();
      return { iso: d.toISOString(), unix: Math.floor(d.getTime() / 1000), formatted: formatDate(d, fmt) };
    }

    case 'format': {
      const raw = nodeData.input
        ? (state.variables[nodeData.input as string] ?? state.variables.lastOutput)
        : state.variables.lastOutput;
      const d = resolveDate(raw);
      const fmt: string = nodeData.format ?? 'ISO';
      return formatDate(d, fmt);
    }

    case 'parse': {
      const raw = nodeData.input
        ? (state.variables[nodeData.input as string] ?? state.variables.lastOutput)
        : state.variables.lastOutput;
      const d = resolveDate(raw);
      return {
        iso:         d.toISOString(),
        unix:        Math.floor(d.getTime() / 1000),
        year:        d.getFullYear(),
        month:       d.getMonth() + 1,
        day:         d.getDate(),
        hour:        d.getHours(),
        minute:      d.getMinutes(),
        second:      d.getSeconds(),
        weekday:     d.toLocaleDateString('en-US', { weekday: 'long' }),
        timezone:    Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }

    case 'add':
    case 'subtract': {
      const raw = nodeData.input
        ? (state.variables[nodeData.input as string] ?? state.variables.lastOutput)
        : state.variables.lastOutput;
      const d = resolveDate(raw);
      const amount: number = Number(nodeData.amount ?? 1);
      const unit: string = nodeData.unit ?? 'days';
      const sign = op === 'add' ? 1 : -1;
      const result = addDuration(d, amount * sign, unit);
      const fmt: string = nodeData.format ?? 'ISO';
      return { iso: result.toISOString(), unix: Math.floor(result.getTime() / 1000), formatted: formatDate(result, fmt) };
    }

    case 'diff': {
      const rawA = nodeData.dateA
        ? (state.variables[nodeData.dateA as string] ?? state.variables.lastOutput)
        : state.variables.lastOutput;
      const rawB = nodeData.dateB
        ? (state.variables[nodeData.dateB as string])
        : new Date();
      const a = resolveDate(rawA);
      const b = resolveDate(rawB);
      const ms = b.getTime() - a.getTime();
      return {
        milliseconds: ms,
        seconds:      Math.floor(ms / 1000),
        minutes:      Math.floor(ms / 60_000),
        hours:        Math.floor(ms / 3_600_000),
        days:         Math.floor(ms / 86_400_000),
        weeks:        Math.floor(ms / 604_800_000),
      };
    }

    default:
      throw new Error(`Unknown datetime operation: ${op}`);
  }
}
