"use client";

import { useEffect, useState } from "react";
import { getSession, setSession, clearSession } from "../../../lib/api";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (s) {
      setName(s.userName);
      setEmail(s.email);
      setWorkspace(s.workspaceName);
      setApiKey(s.apiKey);
      setTenantId(s.tenantId);
    }
  }, []);

  function save() {
    const s = getSession();
    if (!s) return;
    setSession({ ...s, userName: name, email, workspaceName: workspace });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function logout() {
    clearSession();
    router.push("/");
  }

  return (
    <div className="dash-content">
      <header className="dash-header">
        <div>
          <h1 className="dash-title">Settings</h1>
          <p className="dash-sub">Profile and workspace credentials for this device.</p>
        </div>
      </header>
      <div className="dash-panel auth-form" style={{ maxWidth: 480 }}>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>Workspace</label>
        <input value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
        <label>Tenant ID</label>
        <input value={tenantId} readOnly className="readonly" />
        <label>API key</label>
        <input value={apiKey} readOnly className="readonly" />
        <p className="hint">Never commit API keys. Tenant identity for API calls is resolved server-side from this key.</p>
        <button type="button" className="btn-primary" onClick={save}>
          Save profile
        </button>
        {saved && <p className="hint" style={{ color: "var(--sage)" }}>Saved.</p>}
        <button type="button" className="btn-secondary" onClick={logout} style={{ marginTop: 12 }}>
          Log out
        </button>
      </div>
    </div>
  );
}