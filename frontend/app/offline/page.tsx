import Link from "next/link";

export default function Offline() {
  return (
    <main className="page">
      <div className="card fade-in" style={{ textAlign: "center", padding: "3rem 2rem" }}>
        <p style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📡</p>
        <p className="eyebrow" style={{ color: "var(--on-paper-muted)" }}>You&apos;re offline</p>
        <h2 style={{ marginTop: 0 }}>No internet connection</h2>
        <p style={{ color: "var(--on-paper-muted)" }}>
          Your last recommendations may still be visible below.
          Connect to the internet to get fresh results.
        </p>
        <Link href="/" className="btn-primary" style={{ textDecoration: "none", display: "inline-block", marginTop: "1rem" }}>
          Try again
        </Link>
      </div>
    </main>
  );
}
