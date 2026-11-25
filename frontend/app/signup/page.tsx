"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";

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
      // Note: intentionally omitted any local-xxxx random key fallback.
      // Real API errors (network failure, 500, 429, etc.) must surface honestly to the user
      // without silently substituting a fake or mock key.
      const resp = await fetch(`${GATEWAY_ROOT}/tenants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${resp.status})`);
      }
      setResult(await resp.json());
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <Navbar activePage="none" />

      <div style={{ marginBottom: "28px", paddingBottom: "20px", borderBottom: "1px solid var(--hairline-paper)" }}>
        <p className="eyebrow">Nearby &amp; Co. · New workspace</p>
        <h1 style={{ fontSize: "clamp(2rem, 3.2vw, 2.6rem)", margin: "0 0 8px 0" }}>Open a Table</h1>
        <p className="subtitle" style={{ maxWidth: "68ch" }}>Every workspace&apos;s guests, venues, and history are isolated at the database level — enforced by Postgres row-level security, not application code.</p>
      </div>

      {!result ? (
        <form className="card fade-in" onSubmit={submit}>
          <label>Workspace name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Events Co." required />
          <br />
          <button type="submit" className="btn-primary" disabled={loading || !name}>
            {loading ? "Provisioning..." : "Create workspace"}
          </button>
          <p className="hint">
            By creating a workspace you agree to our{" "}
            <Link href="/terms">Terms of Service</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
          {error && <div className="error">{error}</div>}
        </form>
      ) : (
        <div className="card fade-in">
          <p className="eyebrow" style={{ color: "var(--on-paper-muted)" }}>Workspace created</p>
          <p style={{ marginTop: 0 }}>Save this API key — it&apos;s the only credential for this workspace and won&apos;t be shown again.</p>
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
            Use this key on the login page to authenticate and start recommending for this workspace.
          </p>
          <Link href="/login" className="btn-primary" style={{ textDecoration: "none", display: "inline-block", marginRight: 8 }}>
            Go to login →
          </Link>
          <Link href="/" className="btn-secondary" style={{ textDecoration: "none", display: "inline-block" }}>
            Home
          </Link>
        </div>
      )}
    </main>
  );
}
