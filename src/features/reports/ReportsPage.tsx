import { useState } from "react";
import { Link } from "react-router-dom";
import { useConnections } from "../connections/useConnections";
import { useCreateReport, useDeleteReport, useReports } from "./useReports";

export function ReportsPage() {
  const { data: reports, isLoading } = useReports();
  const { data: connections } = useConnections();
  const del = useDeleteReport();

  return (
    <div className="stack" style={{ maxWidth: 800 }}>
      <h2 style={{ margin: 0 }}>Reports</h2>

      {connections && connections.length === 0 ? (
        <div className="card muted">
          Add a JIRA connection first on the <Link to="/connections">Connections</Link> tab.
        </div>
      ) : (
        <NewReportForm />
      )}

      {isLoading && <div className="muted">Loading…</div>}
      {reports && reports.length === 0 && (
        <div className="card muted">No reports yet.</div>
      )}

      {reports?.map((r) => (
        <div key={r.id} className="card row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600 }}>
              <Link to={`/reports/${r.id}`}>{r.name}</Link>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {r.gadgets.length} gadgets · updated{" "}
              {new Date(r.updatedAt).toLocaleString()}
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm(`Delete report "${r.name}"?`)) del.mutate(r.id);
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

function NewReportForm() {
  const { data: connections } = useConnections();
  const create = useCreateReport();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [jql, setJql] = useState("");

  if (!connections) return null;

  if (!open) {
    return (
      <button className="primary" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
        New report
      </button>
    );
  }

  return (
    <form
      className="card stack"
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
        <label>JQL</label>
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
    </form>
  );
}
