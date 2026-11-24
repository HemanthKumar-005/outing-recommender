"use client";
import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("[nearby] unhandled error:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="page">
      <div className="card fade-in">
        <p className="eyebrow" style={{ color: "var(--on-paper-muted)" }}>Something went wrong</p>
        <h2 style={{ marginTop: 0 }}>Unexpected error</h2>
        <p>{error.message || "An unexpected error occurred."}</p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <button className="btn-primary" onClick={reset}>Try again</button>
          <Link href="/" className="btn-secondary" style={{ textDecoration: "none" }}>Go home</Link>
        </div>
      </div>
    </main>
  );
}
