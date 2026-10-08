"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setSession, isOnboarded } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!apiKey.trim()) {
      setError("Enter your workspace API key (from signup).");
      return;
    }
    setLoading(true);
    setSession({
      apiKey: apiKey.trim(),
      workspaceName: workspace.trim() || "My workspace",
      userName: email.trim().split("@")[0] || "User",
      email: email.trim(),
    });
    void remember;
    setTimeout(() => {
      setLoading(false);
      if (isOnboarded()) router.push("/dashboard");
      else router.push("/onboarding");
    }, 400);
  };

  const useDemo = () => {
    setSession({
      apiKey: process.env.NEXT_PUBLIC_API_KEY || "demo-key",
      workspaceName: "Demo workspace",
      userName: "Demo User",
      email: "demo@nearby.co",
    });
    localStorage.setItem("nearby_onboarded", "true");
    router.push("/dashboard");
  };

  return (
    <div className="auth-page">
      <div className="auth-card fade-up">
        <Link href="/" className="logo" style={{ marginBottom: 28, display: "inline-flex" }}>
          <span className="logo-mark">N</span>
          Nearby &amp; Co.
        </Link>
        <h1>Welcome back</h1>
        <p className="lead">Log in with your workspace API key to continue.</p>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="apiKey">Workspace API key</label>
            <input id="apiKey" className="form-input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your API key" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="workspace">Workspace name (optional)</label>
            <input id="workspace" className="form-input" value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="My workspace" />
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input id="remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <label htmlFor="remember" style={{ fontSize: "0.88rem", color: "var(--slate)" }}>Remember me</label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>
        <div className="auth-divider">or</div>
        <button type="button" className="btn btn-secondary btn-block" onClick={useDemo}>
          Continue with demo workspace
        </button>
        <div className="auth-footer">
          New here? <Link href="/signup">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
