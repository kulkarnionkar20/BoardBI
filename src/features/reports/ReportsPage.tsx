import { useState } from "react";
import { Link } from "react-router-dom";
import { HTTPError } from "ky";
import { useConnections } from "../connections/useConnections";
import {
  useCreateReport,
  useDeleteReport,
  useExportReports,
  useImportReports,
  useReports,
} from "./useReports";
import type { ExportFile } from "./types";
import { JqlBuilderDialog } from "./JqlBuilderDialog";

export function ReportsPage() {
  const { data: reports, isLoading } = useReports();
  const { data: connections } = useConnections();
  const del = useDeleteReport();
  const exporter = useExportReports();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function exportSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const file = await exporter.mutateAsync(ids);
    downloadJson(file);
  }

  async function exportOne(id: string) {
    const file = await exporter.mutateAsync([id]);
    downloadJson(file);
  }

  return (
    <div className="stack" style={{ maxWidth: 800 }}>
      <h2 style={{ margin: 0 }}>Reports</h2>

      {connections && connections.length === 0 ? (
        <div className="card muted">
          Add a JIRA connection first on the <Link to="/connections">Connections</Link> tab.
        </div>
      ) : (
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <NewReportForm />
          <button onClick={() => setImportOpen(true)}>Import…</button>
          <button
            disabled={selected.size === 0 || exporter.isPending}
            onClick={exportSelected}
          >
            {exporter.isPending
              ? "Exporting…"
              : `Export selected${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </button>
        </div>
      )}

      {importOpen && (
        <ImportReportsDialog onClose={() => setImportOpen(false)} />
      )}

      {isLoading && <div className="muted">Loading…</div>}
      {reports && reports.length === 0 && (
        <div className="card muted">No reports yet.</div>
      )}

      {reports?.map((r) => (
        <div key={r.id} className="card row" style={{ justifyContent: "space-between" }}>
          <label className="row" style={{ gap: 12, alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
            />
            <div>
              <div style={{ fontWeight: 600 }}>
                <Link to={`/reports/${r.id}`}>{r.name}</Link>
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                {r.gadgets.length} gadgets · updated{" "}
                {new Date(r.updatedAt).toLocaleString()}
              </div>
            </div>
          </label>
          <div className="row" style={{ gap: 8 }}>
            <button onClick={() => exportOne(r.id)} disabled={exporter.isPending}>
              Export
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete report "${r.name}"?`)) del.mutate(r.id);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function downloadJson(file: ExportFile) {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "")
    .replace("T", "-");
  a.download = `boardbi-reports-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function NewReportForm() {
  const { data: connections } = useConnections();
  const create = useCreateReport();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [jql, setJql] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);

  if (!connections) return null;

  if (!open) {
    return (
      <button className="primary" onClick={() => setOpen(true)}>
        New report
      </button>
    );
  }

  return (
    <form
      className="card stack"
      style={{ width: "100%" }}
      onSubmit={async (e) => {
        e.preventDefault();
        await create.mutateAsync({ name, connectionId, jql });
        setOpen(false);
        setName("");
        setJql("");
        setConnectionId("");
      }}
    >
      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label>Connection</label>
        <select value={connectionId} onChange={(e) => setConnectionId(e.target.value)} required>
          <option value="">Choose…</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.baseUrl})
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ margin: 0 }}>JQL</label>
          <button
            type="button"
            disabled={!connectionId}
            title={connectionId ? "Build JQL with the query helper" : "Pick a connection first"}
            onClick={() => setBuilderOpen(true)}
          >
            Build query
          </button>
        </div>
        <textarea
          value={jql}
          onChange={(e) => setJql(e.target.value)}
          rows={3}
          placeholder="project = ABC AND created >= -90d"
        />
      </div>
      {create.error && <div style={{ color: "var(--danger)" }}>{String(create.error)}</div>}
      <div className="row">
        <button className="primary" type="submit" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create"}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {builderOpen && connectionId && (
        <JqlBuilderDialog
          connectionId={connectionId}
          onApply={(s) => setJql(s)}
          onClose={() => setBuilderOpen(false)}
        />
      )}
    </form>
  );
}

function ImportReportsDialog({ onClose }: { onClose: () => void }) {
  const { data: connections } = useConnections();
  const importer = useImportReports();
  const [file, setFile] = useState<ExportFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null);
    setImported(null);
    const f = e.target.files?.[0];
    if (!f) {
      setFile(null);
      setFileName("");
      return;
    }
    setFileName(f.name);
    try {
      const text = await f.text();
      const parsed = JSON.parse(text) as unknown;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        (parsed as { version?: unknown }).version !== 1 ||
        !Array.isArray((parsed as { reports?: unknown }).reports)
      ) {
        setFile(null);
        setParseError("Not a BoardBI export file (expected version 1 with reports[]).");
        return;
      }
      setFile(parsed as ExportFile);
    } catch (err) {
      setFile(null);
      setParseError(err instanceof Error ? err.message : "Could not parse file");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setImported(null);
    if (!file || !connectionId) return;
    try {
      const created = await importer.mutateAsync({ connectionId, file });
      setImported(created.length);
    } catch (err) {
      if (err instanceof HTTPError) {
        const body = (await err.response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setServerError(body?.error ?? `Import failed (${err.response.status})`);
      } else {
        setServerError(err instanceof Error ? err.message : "Import failed");
      }
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div style={{ fontWeight: 600 }}>Import reports</div>
      <div className="field">
        <label>Export file (JSON)</label>
        <input type="file" accept="application/json,.json" onChange={onFileChange} />
        {fileName && file && (
          <div className="muted" style={{ fontSize: 13 }}>
            {fileName} · {file.reports.length} report{file.reports.length === 1 ? "" : "s"}
          </div>
        )}
        {parseError && <div style={{ color: "var(--danger)" }}>{parseError}</div>}
      </div>
      <div className="field">
        <label>Target connection</label>
        <select
          value={connectionId}
          onChange={(e) => setConnectionId(e.target.value)}
          required
        >
          <option value="">Choose…</option>
          {connections?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.baseUrl})
            </option>
          ))}
        </select>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Imported reports will refresh against this connection. Field IDs aren't validated; if
          the JIRA instance is missing referenced fields, refreshes will surface the error.
        </div>
      </div>
      {serverError && <div style={{ color: "var(--danger)" }}>{serverError}</div>}
      {imported !== null && (
        <div className="muted">
          Imported {imported} report{imported === 1 ? "" : "s"}.
        </div>
      )}
      <div className="row">
        <button
          className="primary"
          type="submit"
          disabled={!file || !connectionId || importer.isPending}
        >
          {importer.isPending ? "Importing…" : "Import"}
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </form>
  );
}
