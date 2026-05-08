import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useFields } from "../connections/useFields";
import { useLatestData, useRefreshData, useReport, useUpdateReport } from "../reports/useReports";
import type { GadgetDef, LayoutItem, Report } from "../reports/types";
import { useReportSlicers, useSlicerStore } from "../../store/slicerStore";
import { useTabsStore } from "../../store/tabsStore";
import { ReportToolbar } from "./ReportToolbar";
import { SlicerBar } from "./SlicerBar";
import { ReportCanvas } from "./ReportCanvas";
import { DrillThroughModal } from "./DrillThroughModal";
import type { DrillThrough } from "../gadgets/types";

export function ReportPage({ id }: { id: string }) {
  const { data: report, isLoading, error } = useReport(id);
  const update = useUpdateReport(id);
  const refresh = useRefreshData(id);
  const { data: latest } = useLatestData(id);
  const { data: fieldsResp } = useFields(report?.connectionId);
  const slicers = useReportSlicers(id);
  const setSlicers = useSlicerStore((s) => s.set);
  const updateTabName = useTabsStore((s) => s.updateTabName);

  // Reflect the report name into the tabs store once we know it.
  useEffect(() => {
    if (report) updateTabName(report.id, report.name);
  }, [report, updateTabName]);

  // Local working copies of layout + gadgets so the user can drag/configure
  // without writing on every change. Save flushes to the server.
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [gadgets, setGadgets] = useState<GadgetDef[]>([]);
  const [dirty, setDirty] = useState(false);
  const [drill, setDrill] = useState<DrillThrough | null>(null);

  useEffect(() => {
    if (!report) return;
    setLayout(report.layout);
    setGadgets(report.gadgets);
    setSlicers(id, report.pageSlicers);
    setDirty(false);
  }, [report, id, setSlicers]);

  if (isLoading) return <div className="muted">Loading…</div>;
  if (error || !report) {
    return (
      <div className="card stack">
        <div style={{ color: "var(--danger)" }}>{String(error ?? "Report not found")}</div>
        <Link to="/reports">Back to reports</Link>
      </div>
    );
  }

  const fields = fieldsResp?.fields ?? [];
  const allRows = latest?.rows ?? [];

  const onSave = async () => {
    await update.mutateAsync({
      jql: report.jql,
      layout,
      pageSlicers: slicers,
      gadgets,
    });
    setDirty(false);
  };

  const onJqlSave = async (jql: string) => {
    await update.mutateAsync({ jql });
  };

  const markDirty = () => setDirty(true);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <ReportToolbar
        report={report}
        rowCount={latest?.rowCount}
        truncated={latest?.truncated}
        fetchedAt={latest?.fetchedAt}
        dirty={dirty}
        refreshing={refresh.isPending}
        saving={update.isPending}
        hasDateField={fields.some((f) => f.schema?.type === "date" || f.schema?.type === "datetime")}
        hasGroupField={fields.length > 0}
        onRefresh={() => refresh.mutate()}
        onSave={onSave}
        onJqlSave={onJqlSave}
        onAddGadget={(g, item) => {
          setGadgets([...gadgets, g]);
          setLayout([...layout, item]);
          markDirty();
        }}
        onAddSlicer={(s) => {
          setSlicers(id, [...slicers, s]);
          markDirty();
        }}
      />
      <SlicerBar
        reportId={id}
        rows={allRows}
        fields={fields}
        slicers={slicers}
        onChange={(next) => {
          setSlicers(id, next);
          markDirty();
        }}
      />
      {refresh.error && (
        <div className="card" style={{ color: "var(--danger)" }}>
          {String(refresh.error)}
        </div>
      )}
      <ReportCanvas
        gadgets={gadgets}
        layout={layout}
        rows={allRows}
        pageSlicers={slicers}
        fields={fields}
        onDrillThrough={setDrill}
        onLayoutChange={(next) => {
          setLayout(next);
          markDirty();
        }}
        onConfigChange={(gadgetId, config) => {
          setGadgets(gadgets.map((g) => (g.id === gadgetId ? { ...g, config } : g)));
          markDirty();
        }}
        onRemoveGadget={(gadgetId) => {
          setGadgets(gadgets.filter((g) => g.id !== gadgetId));
          setLayout(layout.filter((l) => l.i !== gadgetId));
          markDirty();
        }}
      />
      {!latest && (
        <EmptyState report={report} onRefresh={() => refresh.mutate()} pending={refresh.isPending} />
      )}
      {drill && <DrillThroughModal drill={drill} fields={fields} onClose={() => setDrill(null)} />}
    </div>
  );
}

function EmptyState({
  report,
  onRefresh,
  pending,
}: {
  report: Report;
  onRefresh: () => void;
  pending: boolean;
}) {
  return (
    <div className="card stack" style={{ alignItems: "flex-start" }}>
      <div style={{ fontWeight: 600 }}>No data yet</div>
      {report.jql.trim().length === 0 ? (
        <div className="muted">Add a JQL query in the toolbar above, then click Refresh.</div>
      ) : (
        <div className="muted">Click Refresh to fetch issues from JIRA.</div>
      )}
      <button className="primary" onClick={onRefresh} disabled={pending || !report.jql.trim()}>
        {pending ? "Fetching…" : "Refresh"}
      </button>
    </div>
  );
}
