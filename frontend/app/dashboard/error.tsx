"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Icons } from "../../components/Icons";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error:", error.digest || "", error.message);
  }, [error]);

  return (
    <div
      className="card fade-up"
      role="alert"
      style={{
        maxWidth: 500,
        margin: "40px auto",
        padding: "36px 28px",
        textAlign: "center",
        background: "var(--bg-surface-elevated)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(244, 63, 94, 0.12)",
          color: "var(--rose-400)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}
      >
        <Icons.AlertCircle size={28} />
      </div>

      <h2 style={{ fontSize: "1.4rem", margin: "0 0 8px", color: "var(--text-primary)" }}>
        Something went wrong
      </h2>
      <p style={{ fontSize: "0.92rem", color: "var(--text-secondary)", margin: "0 0 24px" }}>
        We couldn&apos;t load this section. Your account and preferences are safe.
      </p>

      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button type="button" className="btn btn-primary" onClick={reset}>
          <Icons.RefreshCw size={14} style={{ marginRight: 6 }} /> Try Again
        </button>
        <Link href="/dashboard" className="btn btn-secondary">
          Dashboard Home
        </Link>
      </div>
    </div>
  );
}
