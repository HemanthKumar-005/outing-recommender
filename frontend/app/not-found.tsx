import Link from "next/link";
import { Icons } from "../components/Icons";

export default function NotFound() {
  return (
    <main
      className="container"
      style={{
        minHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "64px 20px",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "rgba(224, 94, 58, 0.12)",
          color: "var(--coral-400)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          boxShadow: "0 0 32px -4px rgba(224, 94, 58, 0.3)",
        }}
      >
        <Icons.Compass size={40} />
      </div>

      <span className="eyebrow" style={{ color: "var(--coral-400)" }}>404 · Destination Off The Map</span>
      <h1 style={{ fontSize: "clamp(2rem, 1.8rem + 1vw, 2.8rem)", margin: "8px 0 12px" }}>
        Lost your way?
      </h1>
      <p className="lead" style={{ maxWidth: 480, margin: "0 auto 32px", color: "var(--text-secondary)" }}>
        The page you&apos;re looking for doesn&apos;t exist, was moved, or has an outdated link.
        Let&apos;s get you back on track to planning a great outing.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/" className="btn btn-primary btn-lg">
          Back to Home
        </Link>
        <Link href="/dashboard" className="btn btn-secondary btn-lg">
          Open Dashboard ↗
        </Link>
      </div>

      <div style={{ marginTop: 48, display: "flex", gap: 16, fontSize: "0.85rem", color: "var(--text-muted)" }}>
        <Link href="/dashboard/discover" style={{ textDecoration: "underline" }}>Discover Places</Link>
        <span>·</span>
        <Link href="/dashboard/date-planner" style={{ textDecoration: "underline" }}>Date Planner</Link>
        <span>·</span>
        <Link href="/model-card" style={{ textDecoration: "underline" }}>Model Card</Link>
      </div>
    </main>
  );
}
