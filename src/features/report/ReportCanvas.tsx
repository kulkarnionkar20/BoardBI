import { useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { FieldDef, JiraIssue } from "../../lib/jqlFields";
import { getGadgetEntry } from "../gadgets/registry";
import type { GadgetDef, LayoutItem } from "../reports/types";
import type { Slicer, SlicerOverrides } from "../../store/slicerStore";
import type { DrillThrough } from "../gadgets/types";
import { applySlicers, effectiveSlicers } from "./useFilteredDataset";
import { SlicerOverridesEditor } from "./SlicerOverridesEditor";

const ResponsiveGrid = WidthProvider(GridLayout);

type Props = {
  gadgets: GadgetDef[];
  layout: LayoutItem[];
  rows: JiraIssue[];
  pageSlicers: Slicer[];
  fields: FieldDef[];
  onDrillThrough: (d: DrillThrough) => void;
  onLayoutChange: (next: LayoutItem[]) => void;
  onConfigChange: (gadgetId: string, config: Record<string, unknown>) => void;
  onRemoveGadget: (gadgetId: string) => void;
};

export function ReportCanvas(props: Props) {
  const [configGadgetId, setConfigGadgetId] = useState<string | null>(null);
  const configGadget = configGadgetId
    ? props.gadgets.find((g) => g.id === configGadgetId) ?? null
    : null;

  // Drop drawer state if the gadget gets removed.
  useEffect(() => {
    if (configGadgetId && !props.gadgets.find((g) => g.id === configGadgetId)) {
      setConfigGadgetId(null);
    }
  }, [props.gadgets, configGadgetId]);

  const handleLayoutChange = (next: Layout[]) => {
    props.onLayoutChange(
      next.map((l) => ({
        i: l.i,
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
        minW: l.minW,
        minH: l.minH,
      })),
    );
  };

  const grid =
    props.gadgets.length === 0 ? (
      <div className="card muted" style={{ textAlign: "center", padding: 32 }}>
        Empty canvas. Click "Add gadget" in the toolbar above to get started.
      </div>
    ) : (
      <ResponsiveGrid
        className="layout"
        layout={props.layout}
        cols={12}
        rowHeight={48}
        margin={[12, 12]}
        isResizable
        resizeHandles={["se", "s", "e"]}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".gadget-drag-handle"
        draggableCancel=".no-drag"
      >
        {props.gadgets.map((g) => (
          <div
            key={g.id}
            className="card"
            style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
          >
            <GadgetFrame
              gadget={g}
              allRows={props.rows}
              pageSlicers={props.pageSlicers}
              fields={props.fields}
              configOpen={configGadgetId === g.id}
              onDrillThrough={props.onDrillThrough}
              onConfigChange={(c) => props.onConfigChange(g.id, c)}
              onOpenConfig={() =>
                setConfigGadgetId(configGadgetId === g.id ? null : g.id)
              }
              onRemove={() => props.onRemoveGadget(g.id)}
            />
          </div>
        ))}
      </ResponsiveGrid>
    );

  return (
    <>
      {grid}
      {configGadget && (
        <GadgetConfigDrawer
          gadget={configGadget}
          allRows={props.rows}
          pageSlicers={props.pageSlicers}
          fields={props.fields}
          onConfigChange={(c) => props.onConfigChange(configGadget.id, c)}
          onClose={() => setConfigGadgetId(null)}
        />
      )}
    </>
  );
}

function GadgetFrame({
  gadget,
  allRows,
  pageSlicers,
  fields,
  configOpen,
  onDrillThrough,
  onConfigChange,
  onOpenConfig,
  onRemove,
}: {
  gadget: GadgetDef;
  allRows: JiraIssue[];
  pageSlicers: Slicer[];
  fields: FieldDef[];
  configOpen: boolean;
  onDrillThrough: (d: DrillThrough) => void;
  onConfigChange: (c: Record<string, unknown>) => void;
  onOpenConfig: () => void;
  onRemove: () => void;
}) {
  const entry = getGadgetEntry(gadget.type);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const overrides = (gadget.config.slicerOverrides ?? {}) as SlicerOverrides;
  const filteredRows = useMemo(
    () => applySlicers(allRows, effectiveSlicers(pageSlicers, overrides)),
    [allRows, pageSlicers, overrides],
  );

  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const r = e.contentRect;
        setSize({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    });
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  if (!entry) {
    return (
      <div style={{ padding: 16 }} className="muted">
        Unknown gadget type: {gadget.type}
      </div>
    );
  }
  const { Render, label, exportRows } = entry;

  const overrideCount = Object.values(overrides).filter(
    (o) => o.disabled || o.value !== undefined,
  ).length;

  const onExport = () => {
    if (!exportRows) return;
    const csv = exportRows({ rows: filteredRows, config: gadget.config, fields });
    if (!csv) return;
    downloadCsv(`${gadget.type}-${gadget.id.slice(0, 8)}.csv`, csv);
  };

  return (
    <>
      <div
        className="gadget-drag-handle row"
        style={{
          padding: "4px 8px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          fontSize: 12,
          cursor: "move",
          justifyContent: "space-between",
        }}
      >
        <span className="muted">
          {label}
          {overrideCount > 0 && (
            <span
              style={{
                marginLeft: 6,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "0 6px",
                fontSize: 11,
              }}
              title={`${overrideCount} slicer override(s)`}
            >
              {overrideCount}↯
            </span>
          )}
        </span>
        <span className="row no-drag" style={{ gap: 4 }}>
          {exportRows && (
            <button
              style={{ padding: "1px 6px", fontSize: 12 }}
              onClick={onExport}
              title="Export CSV"
            >
              ⇣
            </button>
          )}
          <button
            style={{
              padding: "1px 6px",
              fontSize: 12,
              ...(configOpen
                ? { background: "var(--accent)", color: "white", borderColor: "var(--accent)" }
                : {}),
            }}
            onClick={onOpenConfig}
            title="Configure"
          >
            ⚙
          </button>
          <button
            style={{ padding: "1px 6px", fontSize: 12 }}
            onClick={() => {
              if (confirm("Remove this gadget?")) onRemove();
            }}
            title="Remove"
          >
            ×
          </button>
        </span>
      </div>
      <div ref={wrapperRef} style={{ flex: 1, minHeight: 0 }}>
        <Render
          key={`${size.w}x${size.h}`}
          rows={filteredRows}
          config={gadget.config}
          fields={fields}
          onDrillThrough={onDrillThrough}
        />
      </div>
    </>
  );
}

function GadgetConfigDrawer({
  gadget,
  allRows,
  pageSlicers,
  fields,
  onConfigChange,
  onClose,
}: {
  gadget: GadgetDef;
  allRows: JiraIssue[];
  pageSlicers: Slicer[];
  fields: FieldDef[];
  onConfigChange: (c: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const entry = getGadgetEntry(gadget.type);
  const overrides = (gadget.config.slicerOverrides ?? {}) as SlicerOverrides;
  const filteredRows = useMemo(
    () => applySlicers(allRows, effectiveSlicers(pageSlicers, overrides)),
    [allRows, pageSlicers, overrides],
  );

  if (!entry) return null;
  const { Config, label } = entry;

  return (
    <aside className="config-drawer">
      <div className="config-drawer-header">
        <div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>
            Configure
          </div>
          <div style={{ fontWeight: 600 }}>{label}</div>
        </div>
        <button onClick={onClose} title="Close (collapse)">
          ›
        </button>
      </div>
      <div className="config-drawer-body stack">
        <Config
          config={gadget.config}
          onChange={onConfigChange}
          fields={fields}
          rows={filteredRows}
        />
        <hr style={{ width: "100%", border: 0, borderTop: "1px solid var(--border)", margin: "4px 0" }} />
        <SlicerOverridesEditor
          pageSlicers={pageSlicers}
          overrides={overrides}
          rows={allRows}
          onChange={(next) => onConfigChange({ ...gadget.config, slicerOverrides: next })}
        />
      </div>
    </aside>
  );
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
