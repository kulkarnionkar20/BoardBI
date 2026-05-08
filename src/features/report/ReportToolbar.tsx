import { useState } from "react";
import { listGadgetEntries } from "../gadgets/registry";
import type { GadgetDef, LayoutItem, Report } from "../reports/types";
import type { Slicer, SlicerType } from "../../store/slicerStore";

type Props = {
  report: Report;
  rowCount?: number;
  truncated?: boolean;
  fetchedAt?: string;
  dirty: boolean;
  refreshing: boolean;
  saving: boolean;
  hasDateField: boolean;
  hasGroupField: boolean;
  onRefresh: () => void;
  onSave: () => void;
  onJqlSave: (jql: string) => void;
  onAddGadget: (gadget: GadgetDef, layout: LayoutItem) => void;
  onAddSlicer: (slicer: Slicer) => void;
};

const SLICER_LABELS: Record<SlicerType, string> = {
  dateRange: "Date range",
  multiSelect: "Multi-select",
  singleSelect: "Single-select",
  text: "Text search",
};

export function ReportToolbar(props: Props) {
  const [jqlOpen, setJqlOpen] = useState(false);
  const [jql, setJql] = useState(props.report.jql);
  const [addGadgetOpen, setAddGadgetOpen] = useState(false);
  const [addSlicerOpen, setAddSlicerOpen] = useState(false);

  const makeSlicer = (type: SlicerType): Slicer => {
    const id = crypto.randomUUID();
    if (type === "dateRange") {
      return { id, type, field: "created", value: { preset: "thisQuarter" } };
    }
    if (type === "multiSelect") {
      return { id, type, field: "status", value: [] };
    }
    if (type === "singleSelect") {
      return { id, type, field: "priority", value: null };
    }
    return { id, type, field: "summary", value: "" };
  };

  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{props.report.name}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {props.fetchedAt ? (
              <>
                Last fetched {new Date(props.fetchedAt).toLocaleString()} ·{" "}
                {props.rowCount?.toLocaleString()} rows
                {props.truncated && " · truncated"}
              </>
            ) : (
              <>Never fetched</>
            )}
          </div>
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button onClick={() => setJqlOpen((v) => !v)}>Edit JQL</button>
          <button
            onClick={() => {
              setAddGadgetOpen((v) => !v);
              setAddSlicerOpen(false);
            }}
          >
            Add gadget
          </button>
          <button
            onClick={() => {
              setAddSlicerOpen((v) => !v);
              setAddGadgetOpen(false);
            }}
          >
            Add slicer
          </button>
          <button onClick={props.onRefresh} disabled={props.refreshing || !props.report.jql.trim()}>
            {props.refreshing ? "Refreshing…" : "Refresh data"}
          </button>
          <button
            className="primary"
            onClick={props.onSave}
            disabled={props.saving || !props.dirty}
            title={props.dirty ? "Save layout, slicers, and gadgets" : "No changes"}
          >
            {props.saving ? "Saving…" : props.dirty ? "Save*" : "Saved"}
          </button>
        </div>
      </div>

      {jqlOpen && (
        <div className="stack">
          <textarea rows={3} value={jql} onChange={(e) => setJql(e.target.value)} />
          <div className="row">
            <button
              className="primary"
              onClick={() => {
                props.onJqlSave(jql);
                setJqlOpen(false);
              }}
            >
              Save JQL
            </button>
            <button
              onClick={() => {
                setJql(props.report.jql);
                setJqlOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {addGadgetOpen && (
        <div className="row" style={{ flexWrap: "wrap" }}>
          {listGadgetEntries().map((entry) => (
            <button
              key={entry.type}
              onClick={() => {
                const id = crypto.randomUUID();
                const layout: LayoutItem = {
                  i: id,
                  x: 0,
                  y: Infinity,
                  w: entry.defaultLayout.w,
                  h: entry.defaultLayout.h,
                  minW: entry.defaultLayout.minW,
                  minH: entry.defaultLayout.minH,
                };
                props.onAddGadget({ id, type: entry.type, config: entry.defaultConfig }, layout);
                setAddGadgetOpen(false);
              }}
            >
              + {entry.label}
            </button>
          ))}
        </div>
      )}

      {addSlicerOpen && (
        <div className="row" style={{ flexWrap: "wrap" }}>
          {(Object.keys(SLICER_LABELS) as SlicerType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                props.onAddSlicer(makeSlicer(type));
                setAddSlicerOpen(false);
              }}
            >
              + {SLICER_LABELS[type]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
