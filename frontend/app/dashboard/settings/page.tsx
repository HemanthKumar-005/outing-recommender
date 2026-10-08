"use client";

import { useEffect, useState } from "react";
import { getSession, setSession, clearSession } from "../../../lib/api";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (s) {
      setName(s.userName);
      setEmail(s.email);
    }
  }, []);

  function save() {
    const s = getSession();
    if (!s) return;
    setSession({ ...s, userName: name, email });
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
          <p className="dash-sub">Manage your profile and account preferences.</p>
        </div>
      </header>
      <div className="dash-panel auth-form" style={{ maxWidth: 480 }}>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <button type="button" className="btn-primary" onClick={save}>
          Save changes
        </button>
        {saved && <p className="hint" style={{ color: "var(--sage)", marginTop: 8 }}>Changes saved ✓</p>}
        <hr style={{ margin: "24px 0", borderColor: "var(--border)" }} />
        <button type="button" className="btn-secondary" onClick={logout}>
          Log out
        </button>
      </div>
    </div>
  );
}