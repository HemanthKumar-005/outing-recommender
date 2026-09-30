"use client";

import { useState } from "react";
import Link from "next/link";

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const GATEWAY_ROOT = DEFAULT_API_URL.replace(/\/api\/?$/, "");

export default function Signup() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tenant_id: string; api_key: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${GATEWAY_ROOT}/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!resp.ok) throw new Error(`Request failed (${resp.status})`);
      setResult(await resp.json());
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="top-row">
        <div>
          <p className="eyebrow">Nearby &amp; Co. · New workspace</p>
          <h1>Open a table</h1>
          <p className="subtitle">Every workspace's guests, venues, and history are isolated at the database level — enforced by Postgres row-level security, not application code.</p>
        </div>
        <Link href="/" className="btn-secondary" style={{ textDecoration: "none" }}>← Back</Link>
      </div>

      {!result ? (
        <form className="card fade-in" onSubmit={submit}>
          <label>Workspace name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Events Co." required />
          <br />
          <button type="submit" className="btn-primary" disabled={loading || !name}>
            {loading ? "Provisioning..." : "Create workspace"}
          </button>
          {error && <div className="error">{error}</div>}
        </form>
      ) : (
        <div className="card fade-in">
          <p className="eyebrow" style={{ color: "var(--on-paper-muted)" }}>Workspace created</p>
          <p style={{ marginTop: 0 }}>Save this API key — it's the only credential for this workspace and won't be shown again.</p>
          <div className="metric-grid">
            <div className="metric-tile">
              <div className="metric-value" style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>{result.api_key}</div>
              <div className="metric-label">API key</div>
            </div>
            <div className="metric-tile">
              <div className="metric-value" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>{result.tenant_id}</div>
              <div className="metric-label">Workspace ID</div>
            </div>
          </div>
          <p className="hint">
            Paste this key into "Change workspace key" on the home page to start recommending for this workspace.
          </p>
          <Link href="/" className="btn-secondary" style={{ textDecoration: "none", display: "inline-block" }}>
            Go to recommendations →
          </Link>
        </div>
      )}
    </main>
  );
}
