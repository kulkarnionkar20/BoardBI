import { groupKey, numericValue, type JiraIssue } from "./jqlFields";
import { bucketIssueDate, type Bucket } from "./dateBuckets";

export type AggFn = "count" | "sum" | "avg" | "min" | "max";

export type AggSpec = {
  fn: AggFn;
  field?: string; // required for sum/avg/min/max
};

export function aggregate(rows: JiraIssue[], spec: AggSpec): number {
  if (spec.fn === "count") return rows.length;
  if (!spec.field) return 0;
  const nums: number[] = [];
  for (const r of rows) {
    const n = numericValue(r, spec.field);
    if (n !== null) nums.push(n);
  }
  if (nums.length === 0) return 0;
  switch (spec.fn) {
    case "sum":
      return nums.reduce((a, b) => a + b, 0);
    case "avg":
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min":
      return Math.min(...nums);
    case "max":
      return Math.max(...nums);
  }
}

export type GroupedRow = { key: string; value: number; count: number; sortKey?: number };

// When `dateBucket` is set, the groupBy field is read as a date and rows are
// grouped by the bucket label (e.g., "2026-04" for month). The result is
// sorted chronologically. Without `dateBucket`, the field is read as a
// categorical string and the result is sorted by aggregated value desc.
export function groupAndAggregate(
  rows: JiraIssue[],
  groupBy: string,
  spec: AggSpec,
  dateBucket?: Bucket,
): GroupedRow[] {
  if (dateBucket) {
    const groups = new Map<number, { label: string; items: JiraIssue[] }>();
    for (const r of rows) {
      const b = bucketIssueDate(r, groupBy, dateBucket);
      if (!b) continue;
      let g = groups.get(b.sortKey);
      if (!g) {
        g = { label: b.label, items: [] };
        groups.set(b.sortKey, g);
      }
      g.items.push(r);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([sortKey, g]) => ({
        key: g.label,
        value: aggregate(g.items, spec),
        count: g.items.length,
        sortKey,
      }));
  }

  const buckets = new Map<string, JiraIssue[]>();
  for (const r of rows) {
    const k = groupKey(r, groupBy);
    let arr = buckets.get(k);
    if (!arr) {
      arr = [];
      buckets.set(k, arr);
    }
    arr.push(r);
  }
  const out: GroupedRow[] = [];
  for (const [key, items] of buckets) {
    out.push({ key, value: aggregate(items, spec), count: items.length });
  }
  out.sort((a, b) => b.value - a.value);
  return out;
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
