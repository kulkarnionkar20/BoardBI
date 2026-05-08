import { useEffect, useRef, useState } from "react";
import type { FieldDef } from "../../../lib/jqlFields";

type Props = {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  fields: FieldDef[];
  placeholder?: string;
  allowClear?: boolean;
};

// Searchable picker grouped into Standard / Custom. Designed for JIRA, where
// custom fields can number in the hundreds and have non-obvious ids
// (`customfield_10010`). Shows the human label, stores the field id.
export function FieldPicker(props: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    inputRef.current?.focus();
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const selected = props.fields.find((f) => f.id === props.value);

  const q = filter.trim().toLowerCase();
  const matches = (f: FieldDef) =>
    !q || f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q);

  const standard = props.fields.filter((f) => !f.custom && matches(f));
  const custom = props.fields.filter((f) => f.custom && matches(f));
  standard.sort((a, b) => a.name.localeCompare(b.name));
  custom.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div ref={ref} className="no-drag" style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.name : <span className="muted">{props.placeholder ?? "Choose…"}</span>}
        </span>
        <span className="muted">▾</span>
      </button>
      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 10,
            padding: 8,
            maxHeight: 280,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
          }}
        >
          <input
            ref={inputRef}
            placeholder="Search fields…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {props.allowClear && props.value && (
            <button
              type="button"
              onClick={() => {
                props.onChange(undefined);
                setOpen(false);
              }}
            >
              Clear selection
            </button>
          )}
          {standard.length === 0 && custom.length === 0 && (
            <div className="muted" style={{ fontSize: 12 }}>No matches</div>
          )}
          {standard.length > 0 && (
            <FieldGroup
              label="Standard"
              items={standard}
              selectedId={props.value}
              onPick={(id) => {
                props.onChange(id);
                setOpen(false);
              }}
            />
          )}
          {custom.length > 0 && (
            <FieldGroup
              label="Custom"
              items={custom}
              selectedId={props.value}
              onPick={(id) => {
                props.onChange(id);
                setOpen(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FieldGroup({
  label,
  items,
  selectedId,
  onPick,
}: {
  label: string;
  items: FieldDef[];
  selectedId: string | undefined;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 4px" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((f) => (
          <button
            type="button"
            key={f.id}
            onClick={() => onPick(f.id)}
            style={{
              border: 0,
              background: f.id === selectedId ? "var(--bg)" : "transparent",
              textAlign: "left",
              padding: "4px 6px",
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              borderRadius: 4,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f.name}
            </span>
            <span className="muted" style={{ fontSize: 11 }}>{f.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
