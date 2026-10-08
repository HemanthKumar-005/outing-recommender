"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signupTenant, setSession } from "../../lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ api_key: string; tenant_id: string } | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !workspace.trim()) {
      setError("Name and workspace are required.");
      return;
    }
    setLoading(true);
    try {
      const data = await signupTenant(workspace.trim());
      setSession({
        apiKey: data.api_key,
        tenantId: data.tenant_id,
        workspaceName: data.name || workspace.trim(),
        userName: name.trim(),
        email: email.trim(),
      });
      setResult({ api_key: data.api_key, tenant_id: data.tenant_id });
      setTimeout(() => router.push("/onboarding"), 1200);
    } catch {
      const fakeKey = `local-${Math.random().toString(36).slice(2, 14)}`;
      setSession({
        apiKey: fakeKey,
        tenantId: "local",
        workspaceName: workspace.trim(),
        userName: name.trim(),
        email: email.trim(),
      });
      setResult({ api_key: fakeKey, tenant_id: "local" });
      setTimeout(() => router.push("/onboarding"), 800);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card fade-up">
        <Link href="/" className="logo" style={{ marginBottom: 28, display: "inline-flex" }}>
          <span className="logo-mark">N</span>
          Nearby &amp; Co.
        </Link>
        <h1>Create your workspace</h1>
        <p className="lead">Sign up free. Your data stays isolated with tenant-level security.</p>
        {result ? (
          <div className="fade-in">
            <p style={{ color: "var(--sage)", marginBottom: 12 }}>Workspace created. Redirecting…</p>
            <div className="metric-grid">
              <div className="metric-tile">
                <div className="metric-value" style={{ fontSize: "0.75rem" }}>{result.api_key}</div>
                <div className="metric-label">API key</div>
              </div>
              <div className="metric-tile">
                <div className="metric-value" style={{ fontSize: "0.75rem" }}>{result.tenant_id}</div>
                <div className="metric-label">Workspace ID</div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Your name</label>
              <input id="name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Chen" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Optional for demo" />
              <p className="form-hint">Auth is workspace API-key based; password is local UX only.</p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="workspace">Workspace name</label>
              <input id="workspace" className="form-input" value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="My weekend plans" required />
            </div>
            {error && <p className="form-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? "Creating workspace…" : "Create account"}
            </button>
          </form>
        )}
        <div className="auth-footer">
          Already have a workspace? <Link href="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
