import { useState } from "react";
import {
  useConnections,
  useCreateConnection,
  useDeleteConnection,
  useTestConnection,
} from "./useConnections";
import type { TestConnectionResult } from "./types";

export function ConnectionsPage() {
  const { data: connections, isLoading, error } = useConnections();

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <h2 style={{ margin: 0 }}>JIRA Connections</h2>
      <p className="muted" style={{ margin: 0 }}>
        Connect BoardBI to a JIRA Cloud site. API tokens are encrypted at rest.
      </p>

      <NewConnectionForm />

      {isLoading && <div className="muted">Loading…</div>}
      {error && <div style={{ color: "var(--danger)" }}>{String(error)}</div>}
      {connections && connections.length === 0 && (
        <div className="card muted">No connections yet.</div>
      )}
      {connections?.map((c) => (
        <ConnectionCard key={c.id} id={c.id} name={c.name} baseUrl={c.baseUrl} email={c.email} />
      ))}
    </div>
  );
}

function NewConnectionForm() {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [open, setOpen] = useState(false);
  const create = useCreateConnection();

  if (!open) {
    return (
      <button className="primary" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
        Add connection
      </button>
    );
  }

  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        await create.mutateAsync({ name, baseUrl, email, apiToken });
        setName("");
        setBaseUrl("");
        setEmail("");
        setApiToken("");
        setOpen(false);
      }}
    >
      <div className="field">
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My JIRA" required />
      </div>
      <div className="field">
        <label>Base URL</label>
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://your-site.atlassian.net"
          type="url"
          required
        />
      </div>
      <div className="field">
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
      </div>
      <div className="field">
        <label>API token</label>
        <input
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          type="password"
          required
          autoComplete="off"
        />
      </div>
      {create.error && (
        <div style={{ color: "var(--danger)" }}>{String(create.error)}</div>
      )}
      <div className="row">
        <button className="primary" type="submit" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ConnectionCard(props: { id: string; name: string; baseUrl: string; email: string }) {
  const test = useTestConnection();
  const del = useDeleteConnection();
  const [result, setResult] = useState<TestConnectionResult | null>(null);

  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{props.name}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {props.baseUrl} · {props.email}
          </div>
        </div>
        <div className="row">
          <button
            onClick={async () => setResult(await test.mutateAsync(props.id))}
            disabled={test.isPending}
          >
            {test.isPending ? "Testing…" : "Test"}
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete connection "${props.name}"?`)) del.mutate(props.id);
            }}
            disabled={del.isPending}
          >
            Delete
          </button>
        </div>
      </div>
      {result && result.ok && (
        <div style={{ color: "green" }}>
          Connected as {result.displayName}
          {result.emailAddress ? ` (${result.emailAddress})` : ""}
        </div>
      )}
      {result && !result.ok && (
        <div style={{ color: "var(--danger)" }}>{result.error}</div>
      )}
    </div>
  );
}
