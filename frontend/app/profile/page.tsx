"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user, status, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main className="page" style={{ maxWidth: 840, minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--on-paper-muted)" }}>
          <p>Loading your account profile...</p>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const initials = user.name
    ? user.name
        .split(/\s+/)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  return (
    <main className="page" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <Link href="/" className="btn-secondary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          ← Back to Home
        </Link>
      </div>

      <div className="card fade-in" style={{ padding: "36px 32px" }}>
        {/* User Profile Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", marginBottom: 32 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #087F73 0%, #13A89E 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.75rem",
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              boxShadow: "0 8px 24px -6px rgba(8, 127, 115, 0.4)",
            }}
          >
            {initials}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: "1.85rem", margin: "0 0 4px 0", fontStyle: "normal" }}>
              {user.name}
            </h1>
            <p style={{ margin: 0, color: "var(--on-paper-muted)", fontSize: "0.95rem" }}>
              {user.email}
            </p>
            <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: "var(--surface-soft)", padding: "3px 10px", borderRadius: 999, fontSize: "0.76rem", fontWeight: 600, color: "var(--accent)" }}>
              <span>✓ Verified Outing Explorer</span>
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--hairline-paper)", margin: "24px 0" }} />

        {/* Account Details & Outing Preferences */}
        <h2 style={{ fontSize: "1.2rem", margin: "0 0 16px 0", fontFamily: "var(--font-display)" }}>
          Outing &amp; Travel Preferences
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
          <div style={{ padding: "16px 18px", background: "var(--surface-soft)", borderRadius: 12, border: "1px solid var(--hairline-paper)" }}>
            <span style={{ fontSize: "0.76rem", color: "var(--on-paper-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Default Budget Tier
            </span>
            <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--on-paper-ink)", marginTop: 4 }}>
              ₹400 – ₹750 / person ($$)
            </div>
          </div>

          <div style={{ padding: "16px 18px", background: "var(--surface-soft)", borderRadius: 12, border: "1px solid var(--hairline-paper)" }}>
            <span style={{ fontSize: "0.76rem", color: "var(--on-paper-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Preferred Travel Mode
            </span>
            <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--on-paper-ink)", marginTop: 4 }}>
              🚗 Driving &amp; Walking
            </div>
          </div>

          <div style={{ padding: "16px 18px", background: "var(--surface-soft)", borderRadius: 12, border: "1px solid var(--hairline-paper)" }}>
            <span style={{ fontSize: "0.76rem", color: "var(--on-paper-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Favorite Categories
            </span>
            <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--on-paper-ink)", marginTop: 4 }}>
              ☕ Cafes, 🌿 Parks, 🍺 Breweries
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <Link
            href="/planner"
            className="btn-primary"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              margin: 0,
              padding: "11px 22px",
            }}
          >
            Open Outing Planner →
          </Link>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => logout()}
            style={{
              color: "#b91c1c",
              borderColor: "rgba(185, 28, 28, 0.3)",
              margin: 0,
              padding: "10px 18px",
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </main>
  );
}
