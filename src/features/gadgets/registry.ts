import { barEntry } from "./BarChart";
import { kpiEntry } from "./KpiTile";
import { lineEntry } from "./LineChart";
import { pieEntry } from "./PieChart";
import { tableEntry } from "./Table";
import type { GadgetEntry } from "./types";
import type { GadgetType } from "../reports/types";

const ENTRIES: Record<GadgetType, GadgetEntry> = {
  table: tableEntry,
  bar: barEntry,
  kpi: kpiEntry,
  pie: pieEntry,
  line: lineEntry,
};

export function getGadgetEntry(type: GadgetType): GadgetEntry | undefined {
  return ENTRIES[type];
}

export function listGadgetEntries(): GadgetEntry[] {
  return [tableEntry, kpiEntry, barEntry, pieEntry, lineEntry];
}
