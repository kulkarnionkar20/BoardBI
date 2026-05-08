import { create } from "zustand";
import type { DateRangeValue } from "../lib/dateBuckets";

// Page-level slicer values per report. Persisted on the server with the
// report definition; we mirror the live state here so gadgets can subscribe
// without prop-drilling through react-grid-layout children.

export type DateRangeSlicer = {
  id: string;
  type: "dateRange";
  field: string;
  label?: string;
  value: DateRangeValue;
};

export type MultiSelectSlicer = {
  id: string;
  type: "multiSelect";
  field: string;
  label?: string;
  // Selected values; empty array means "no filter applied".
  value: string[];
};

export type SingleSelectSlicer = {
  id: string;
  type: "singleSelect";
  field: string;
  label?: string;
  // null/empty string => "no filter applied".
  value: string | null;
};

export type TextSlicer = {
  id: string;
  type: "text";
  field: string;
  label?: string;
  // Empty string => "no filter applied".
  value: string;
};

export type Slicer =
  | DateRangeSlicer
  | MultiSelectSlicer
  | SingleSelectSlicer
  | TextSlicer;

export type SlicerType = Slicer["type"];

// Per-gadget override of a page slicer. Keyed by page slicer id.
//   { disabled: true }           => the page slicer doesn't apply to this gadget
//   { value: ... }               => same type/field, but a different value
//   undefined / not present      => inherit
export type SlicerOverride = { disabled?: boolean; value?: Slicer["value"] };
export type SlicerOverrides = Record<string, SlicerOverride>;

type State = {
  byReport: Record<string, Slicer[]>;
  set: (reportId: string, slicers: Slicer[]) => void;
  upsertSlicer: (reportId: string, slicer: Slicer) => void;
  removeSlicer: (reportId: string, slicerId: string) => void;
};

export const useSlicerStore = create<State>((set) => ({
  byReport: {},
  set: (reportId, slicers) =>
    set((s) => ({ byReport: { ...s.byReport, [reportId]: slicers } })),
  upsertSlicer: (reportId, slicer) =>
    set((s) => {
      const cur = s.byReport[reportId] ?? [];
      const idx = cur.findIndex((x) => x.id === slicer.id);
      const next = idx >= 0 ? [...cur.slice(0, idx), slicer, ...cur.slice(idx + 1)] : [...cur, slicer];
      return { byReport: { ...s.byReport, [reportId]: next } };
    }),
  removeSlicer: (reportId, slicerId) =>
    set((s) => ({
      byReport: {
        ...s.byReport,
        [reportId]: (s.byReport[reportId] ?? []).filter((x) => x.id !== slicerId),
      },
    })),
}));

// Hoisted so the empty-state selector returns a stable reference. Returning a
// fresh `[]` from a useSyncExternalStore selector triggers the tearing check
// to schedule an infinite re-render loop.
const EMPTY_SLICERS: Slicer[] = [];

export function useReportSlicers(reportId: string): Slicer[] {
  return useSlicerStore((s) => s.byReport[reportId] ?? EMPTY_SLICERS);
}
