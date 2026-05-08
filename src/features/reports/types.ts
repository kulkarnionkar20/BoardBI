import type { Slicer } from "../../store/slicerStore";
import type { JiraIssue } from "../../lib/jqlFields";

export type GadgetType = "table" | "bar" | "pie" | "line" | "kpi";

export type GadgetDef = {
  id: string;
  type: GadgetType;
  config: Record<string, unknown>;
};

export type LayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
};

export type Report = {
  id: string;
  name: string;
  description: string | null;
  connectionId: string;
  jql: string;
  layout: LayoutItem[];
  pageSlicers: Slicer[];
  gadgets: GadgetDef[];
  createdAt: string;
  updatedAt: string;
};

export type CreateReportInput = {
  name: string;
  description?: string;
  connectionId: string;
  jql: string;
};

export type UpdateReportInput = Partial<{
  name: string;
  description: string;
  jql: string;
  layout: LayoutItem[];
  pageSlicers: Slicer[];
  gadgets: GadgetDef[];
}>;

export type ReportData = {
  snapshotId: string;
  fetchedAt: string;
  rowCount: number;
  truncated: boolean;
  total?: number;
  rows: JiraIssue[];
};
