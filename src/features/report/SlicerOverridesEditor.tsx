import { format } from "date-fns";
import { resolveRange, PRESET_LABELS, type DateRangePreset, type DateRangeValue } from "../../lib/dateBuckets";
import type { JiraIssue } from "../../lib/jqlFields";
import { groupKey } from "../../lib/jqlFields";
import type { Slicer, SlicerOverride, SlicerOverrides } from "../../store/slicerStore";

type Props = {
  pageSlicers: Slicer[];
  overrides: SlicerOverrides;
  rows: JiraIssue[];
  onChange: (next: SlicerOverrides) => void;
};

export function SlicerOverridesEditor(props: Props) {
  if (props.pageSlicers.length === 0) {
    return (
      <div className="muted" style={{ fontSize: 12 }}>
        No page-level slicers to override.
      </div>
    );
  }

  const setOverride = (slicerId: string, override: SlicerOverride | null) => {
    const next = { ...props.overrides };
    if (override === null) delete next[slicerId];
    else next[slicerId] = override;
    props.onChange(next);
  };

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>Slicer overrides</div>
      <div className="muted" style={{ fontSize: 12, marginTop: -4 }}>
        Inherit, override, or disable each page slicer for this gadget.
      </div>
      {props.pageSlicers.map((s) => {
        const o = props.overrides[s.id];
        const mode: "inherit" | "override" | "disabled" = o?.disabled
          ? "disabled"
          : o?.value !== undefined
            ? "override"
            : "inherit";
        return (
          <div key={s.id} className="card stack" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: 13 }}>
                <strong>{slicerSummary(s)}</strong>
              </span>
              <select
                value={mode}
                onChange={(e) => {
                  const m = e.target.value as typeof mode;
                  if (m === "inherit") setOverride(s.id, null);
                  else if (m === "disabled") setOverride(s.id, { disabled: true });
                  else setOverride(s.id, { value: s.value });
                }}
              >
                <option value="inherit">Inherit</option>
                <option value="override">Override</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            {mode === "override" && (
              <OverrideValueEditor
                slicer={s}
                value={(o?.value ?? s.value) as Slicer["value"]}
                rows={props.rows}
                onChange={(value) => setOverride(s.id, { value })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function slicerSummary(s: Slicer): string {
  switch (s.type) {
    case "dateRange":
      return `Date range · ${s.field}`;
    case "multiSelect":
      return `Multi-select · ${s.field}`;
    case "singleSelect":
      return `Single-select · ${s.field}`;
    case "text":
      return `Text · ${s.field}`;
  }
}

function OverrideValueEditor({
  slicer,
  value,
  rows,
  onChange,
}: {
  slicer: Slicer;
  value: Slicer["value"];
  rows: JiraIssue[];
  onChange: (v: Slicer["value"]) => void;
}) {
  if (slicer.type === "dateRange") {
    const v = value as DateRangeValue;
    const range = resolveRange(v);
    return (
      <div className="stack" style={{ gap: 6 }}>
        <select
          value={v.preset}
          onChange={(e) => onChange({ ...v, preset: e.target.value as DateRangePreset })}
        >
          {(Object.keys(PRESET_LABELS) as DateRangePreset[]).map((p) => (
            <option key={p} value={p}>
              {PRESET_LABELS[p]}
            </option>
          ))}
        </select>
        {v.preset === "custom" && (
          <div className="row">
            <input
              type="date"
              value={v.from?.slice(0, 10) ?? ""}
              onChange={(e) =>
                onChange({ ...v, from: e.target.value ? new Date(e.target.value).toISOString() : undefined })
              }
            />
            <input
              type="date"
              value={v.to?.slice(0, 10) ?? ""}
              onChange={(e) =>
                onChange({ ...v, to: e.target.value ? new Date(e.target.value).toISOString() : undefined })
              }
            />
          </div>
        )}
        {range && (
          <div className="muted" style={{ fontSize: 12 }}>
            {format(range.from, "MMM d, yyyy")} – {format(range.to, "MMM d, yyyy")}
          </div>
        )}
      </div>
    );
  }

  if (slicer.type === "multiSelect" || slicer.type === "singleSelect") {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const k = groupKey(r, slicer.field);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const opts = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (slicer.type === "multiSelect") {
      const v = (value as string[]) ?? [];
      const toggle = (k: string) => {
        const set = new Set(v);
        if (set.has(k)) set.delete(k);
        else set.add(k);
        onChange([...set]);
      };
      return (
        <div
          className="no-drag"
          style={{ maxHeight: 160, overflow: "auto", display: "flex", flexDirection: "column", gap: 4 }}
        >
          {opts.length === 0 && <div className="muted" style={{ fontSize: 12 }}>No values</div>}
          {opts.map(([key, count]) => (
            <label key={key} className="row" style={{ fontSize: 13, gap: 6 }}>
              <input type="checkbox" checked={v.includes(key)} onChange={() => toggle(key)} />
              <span style={{ flex: 1 }}>{key}</span>
              <span className="muted">{count}</span>
            </label>
          ))}
        </div>
      );
    }
    const v = (value as string | null) ?? "";
    return (
      <select value={v ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">(any)</option>
        {opts.map(([key, count]) => (
          <option key={key} value={key}>
            {key} ({count})
          </option>
        ))}
      </select>
    );
  }

  // text
  const v = (value as string) ?? "";
  return (
    <input
      placeholder="Contains…"
      value={v}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
