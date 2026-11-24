import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <div className="card fade-in">
        <p className="eyebrow" style={{ color: "var(--on-paper-muted)" }}>404</p>
        <h2 style={{ marginTop: 0 }}>Page not found</h2>
        <p>This page doesn't exist or may have moved.</p>
        <Link href="/" className="btn-secondary" style={{ textDecoration: "none", display: "inline-block", marginTop: "0.5rem" }}>
          ← Back to recommendations
        </Link>
      </div>
    </main>
  );
}
