"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchMe, logoutUser, deleteMyAccount, setLocationConsent, type SessionUser } from "../../../lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    fetchMe().then(setUser);
  }, []);

  async function logout() {
    await logoutUser();
    router.push("/");
  }

  async function toggleLocation(granted: boolean) {
    setBusy(true);
    try {
      setUser(await setLocationConsent(granted));
      setMessage(granted ? "Location use enabled." : "Location use turned off.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await deleteMyAccount();
      router.push("/?deleted=1");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not delete your account.");
      setBusy(false);
    }
  }

  return (
    <div className="dash-content">
      <header className="dash-header">
        <div>
          <h1 className="dash-title">Settings</h1>
          <p className="dash-sub">Your account, privacy and data.</p>
        </div>
      </header>
      <div className="dash-panel auth-form" style={{ maxWidth: 560 }}>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={user?.name ?? ""} readOnly />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" value={user?.email ?? ""} readOnly />
        </div>

        <hr style={{ margin: "24px 0", borderColor: "var(--hairline)" }} />
        <h3 style={{ marginBottom: 8 }}>Location</h3>
        <p className="hint" style={{ marginBottom: 12 }}>
          The app currently uses the city or area you pick, not your device&apos;s GPS. This switch records your consent
          for a future &quot;near me&quot; feature, so nothing changes until we ship it. You can turn it off at any time.
        </p>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={!!user?.location_consent_at}
            disabled={busy || !user}
            onChange={(e) => toggleLocation(e.target.checked)}
          />
          Use my location
        </label>
        {message && <p className="hint" style={{ color: "var(--sage)", marginTop: 8 }} role="status">{message}</p>}

        <hr style={{ margin: "24px 0", borderColor: "var(--hairline)" }} />
        <h3 style={{ marginBottom: 8 }}>Your data</h3>
        <p className="hint" style={{ marginBottom: 12 }}>
          See our <Link href="/privacy">Privacy Policy</Link> for what we collect and why.
        </p>
        <button type="button" className="btn btn-secondary" onClick={logout}>
          Log out
        </button>

        <hr style={{ margin: "24px 0", borderColor: "var(--hairline)" }} />
        <h3 style={{ marginBottom: 8, color: "var(--danger, #b3261e)" }}>Delete account</h3>
        <p className="hint" style={{ marginBottom: 12 }}>
          This permanently deletes your profile, saved plans, activity and notifications. It cannot be undone.
          Type <strong>DELETE</strong> to confirm.
        </p>
        <input className="form-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" style={{ marginBottom: 12 }} />
        <button type="button" className="btn btn-secondary" disabled={busy || confirmText !== "DELETE"} onClick={deleteAccount}>
          Permanently delete my account
        </button>
      </div>
    </div>
  );
}
