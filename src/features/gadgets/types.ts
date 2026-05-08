import type { ComponentType } from "react";
import type { JiraIssue, FieldDef } from "../../lib/jqlFields";
import type { GadgetDef, GadgetType } from "../reports/types";
import type { AggFn } from "../../lib/aggregate";

export type DrillThrough = {
  title: string;
  rows: JiraIssue[];
};

export type GadgetRenderProps = {
  rows: JiraIssue[];
  config: Record<string, unknown>;
  fields: FieldDef[];
  onDrillThrough?: (d: DrillThrough) => void;
};

export type GadgetConfigProps = {
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  fields: FieldDef[];
  rows: JiraIssue[];
};

export type GadgetEntry = {
  type: GadgetType;
  label: string;
  defaultConfig: Record<string, unknown>;
  defaultLayout: { w: number; h: number; minW?: number; minH?: number };
  Render: ComponentType<GadgetRenderProps>;
  Config: ComponentType<GadgetConfigProps>;
  // Returns CSV (or null/empty to disable). Should reflect the rows the gadget
  // is currently rendering (i.e. after page slicers + per-gadget overrides).
  exportRows?: (args: {
    rows: JiraIssue[];
    config: Record<string, unknown>;
    fields: FieldDef[];
  }) => string | null;
};

export type AggConfig = {
  fn: AggFn;
  field?: string;
};

export type GadgetWithRuntime = GadgetDef & { entry: GadgetEntry };
