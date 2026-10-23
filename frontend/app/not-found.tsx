import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container" style={{ padding: "64px 20px", textAlign: "center" }}>
      <h1>Page not found</h1>
      <p className="hint">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <Link href="/" className="btn btn-primary">Back to home</Link>
    </main>
  );
}
