import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format as formatDate,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
  subQuarters,
} from "date-fns";
import { aggregate, type AggSpec } from "./aggregate";
import { dateValue, isDateField, type FieldDef, type JiraIssue } from "./jqlFields";

export type DateRangePreset =
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "lastQuarter"
  | "ytd"
  | "custom";

export type DateRangeValue = {
  preset: DateRangePreset;
  // ISO strings; only meaningful when preset === "custom" or to display the
  // resolved range from a non-custom preset.
  from?: string;
  to?: string;
};

export function resolveRange(
  v: DateRangeValue,
  now: Date = new Date(),
): { from: Date; to: Date } | null {
  switch (v.preset) {
    case "thisMonth":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "lastMonth": {
      const d = subMonths(now, 1);
      return { from: startOfMonth(d), to: endOfMonth(d) };
    }
    case "thisQuarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "lastQuarter": {
      const d = subQuarters(now, 1);
      return { from: startOfQuarter(d), to: endOfQuarter(d) };
    }
    case "ytd":
      return { from: startOfYear(now), to: endOfYear(now) };
    case "custom": {
      if (!v.from || !v.to) return null;
      const from = new Date(v.from);
      const to = new Date(v.to);
      if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return null;
      return { from: startOfDay(from), to: endOfDay(to) };
    }
  }
}

export const PRESET_LABELS: Record<DateRangePreset, string> = {
  thisMonth: "This month",
  lastMonth: "Last month",
  thisQuarter: "This quarter",
  lastQuarter: "Last quarter",
  ytd: "Year to date",
  custom: "Custom",
};

export type Bucket = "day" | "week" | "month" | "quarter" | "year";

export const BUCKET_LABELS: Record<Bucket, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

function startOf(bucket: Bucket, d: Date): Date {
  switch (bucket) {
    case "day":
      return startOfDay(d);
    case "week":
      return startOfWeek(d, { weekStartsOn: 1 });
    case "month":
      return startOfMonth(d);
    case "quarter":
      return startOfQuarter(d);
    case "year":
      return startOfYear(d);
  }
}

export function bucketLabel(bucket: Bucket, d: Date): string {
  switch (bucket) {
    case "day":
      return formatDate(d, "yyyy-MM-dd");
    case "week":
      return formatDate(d, "yyyy-MM-dd");
    case "month":
      return formatDate(d, "yyyy-MM");
    case "quarter":
      return `${formatDate(d, "yyyy")} Q${Math.floor(d.getMonth() / 3) + 1}`;
    case "year":
      return formatDate(d, "yyyy");
  }
}

// Bucket a single issue's date-field into a chronological key + display label.
// Returns null when the field has no parseable value.
export function bucketIssueDate(
  issue: JiraIssue,
  fieldId: string,
  bucket: Bucket,
): { sortKey: number; label: string } | null {
  const d = dateValue(issue, fieldId);
  if (!d) return null;
  const start = startOf(bucket, d);
  return { sortKey: start.getTime(), label: bucketLabel(bucket, start) };
}

export function isDateFieldId(fields: FieldDef[], fieldId: string | undefined): boolean {
  if (!fieldId) return false;
  const f = fields.find((x) => x.id === fieldId);
  return !!f && isDateField(f);
}

// Returns rows whose date-field value falls in the same bucket as `bucketLabel`.
// Used by line-chart drill-through where we know the X-axis label of the
// clicked point and need to recover the underlying issues.
export function rowsForDateBucket(
  rows: JiraIssue[],
  dateField: string,
  bucket: Bucket,
  label: string,
): JiraIssue[] {
  return rows.filter((r) => {
    const d = dateValue(r, dateField);
    if (!d) return false;
    return bucketLabel(bucket, startOf(bucket, d)) === label;
  });
}

export type TimeSeriesPoint = { bucket: string; sortKey: number; value: number; count: number };

// Buckets rows by a date field, aggregates per bucket, returns chronologically.
export function bucketByDate(
  rows: JiraIssue[],
  dateField: string,
  bucket: Bucket,
  spec: AggSpec,
): TimeSeriesPoint[] {
  const groups = new Map<number, { date: Date; items: JiraIssue[] }>();
  for (const r of rows) {
    const d = dateValue(r, dateField);
    if (!d) continue;
    const start = startOf(bucket, d);
    const key = start.getTime();
    let group = groups.get(key);
    if (!group) {
      group = { date: start, items: [] };
      groups.set(key, group);
    }
    group.items.push(r);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([sortKey, g]) => ({
      bucket: bucketLabel(bucket, g.date),
      sortKey,
      value: aggregate(g.items, spec),
      count: g.items.length,
    }));
}
