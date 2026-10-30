"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        textAlign: "center",
        background: "var(--bg-canvas, #160f0d)",
        color: "var(--text-primary, #fff)",
        fontFamily: "var(--font-body, system-ui)",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 480,
          padding: "36px 28px",
          borderRadius: 16,
          background: "var(--bg-surface, #201714)",
          border: "1px solid var(--border-default, rgba(255,255,255,0.14))",
        }}
      >
        <h2 style={{ fontSize: "1.5rem", marginBottom: 8 }}>An unexpected error occurred</h2>
        <p style={{ color: "var(--text-secondary, #d0c2b4)", fontSize: "0.95rem", marginBottom: 24 }}>
          We encountered an issue rendering this view. Please try reloading or head back to home.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button type="button" className="btn btn-primary" onClick={reset}>
            Try Again
          </button>
          <Link href="/" className="btn btn-secondary">
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
