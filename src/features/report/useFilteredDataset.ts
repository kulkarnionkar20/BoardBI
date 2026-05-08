import { useMemo } from "react";
import { dateValue, displayValue, groupKey, type JiraIssue } from "../../lib/jqlFields";
import { resolveRange } from "../../lib/dateBuckets";
import type { Slicer, SlicerOverrides } from "../../store/slicerStore";

// Apply a list of slicers to the dataset. Each slicer is independent; an
// issue passes if it satisfies every slicer.

export function applySlicers(rows: JiraIssue[], slicers: Slicer[]): JiraIssue[] {
  if (slicers.length === 0) return rows;
  return rows.filter((row) => {
    for (const s of slicers) {
      if (!matchesSlicer(row, s)) return false;
    }
    return true;
  });
}

function matchesSlicer(row: JiraIssue, s: Slicer): boolean {
  if (s.type === "dateRange") {
    const range = resolveRange(s.value);
    if (!range) return true; // unset custom range => no-op
    const d = dateValue(row, s.field);
    if (!d) return false;
    return d >= range.from && d <= range.to;
  }
  if (s.type === "multiSelect") {
    if (s.value.length === 0) return true;
    const k = groupKey(row, s.field);
    return s.value.includes(k);
  }
  if (s.type === "singleSelect") {
    if (!s.value) return true;
    return groupKey(row, s.field) === s.value;
  }
  if (s.type === "text") {
    const q = s.value.trim().toLowerCase();
    if (!q) return true;
    return displayValue(row, s.field).toLowerCase().includes(q);
  }
  return true;
}

// Compute the effective slicer list for a single gadget, applying its
// overrides. Per-gadget overrides REPLACE the page slicer of the same id
// (Power BI semantics): when set, the override's value is used; when
// disabled, the slicer drops out entirely for this gadget.
export function effectiveSlicers(
  pageSlicers: Slicer[],
  overrides: SlicerOverrides | undefined,
): Slicer[] {
  if (!overrides) return pageSlicers;
  const out: Slicer[] = [];
  for (const s of pageSlicers) {
    const o = overrides[s.id];
    if (!o) {
      out.push(s);
      continue;
    }
    if (o.disabled) continue;
    if (o.value !== undefined) {
      out.push({ ...s, value: o.value } as Slicer);
      continue;
    }
    out.push(s);
  }
  return out;
}

export function useFilteredDataset(rows: JiraIssue[] | undefined, slicers: Slicer[]): JiraIssue[] {
  return useMemo(() => applySlicers(rows ?? [], slicers), [rows, slicers]);
}
