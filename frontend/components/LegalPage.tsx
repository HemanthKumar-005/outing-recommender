import Link from "next/link";
import { SUPPORT_EMAIL } from "../lib/site";

export function ContactLine() {
  return SUPPORT_EMAIL ? (
    <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
  ) : (
    <strong>[operator: set NEXT_PUBLIC_SUPPORT_EMAIL before launch]</strong>
  );
}

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="container" style={{ maxWidth: 780, padding: "48px 20px" }}>
      <p><Link href="/">← Nearby &amp; Co.</Link></p>
      <h1>{title}</h1>
      <p className="hint">Version {updated}. Beta software operated by an individual; not a registered company.</p>
      <p className="hint" style={{ border: "1px solid var(--hairline)", padding: 12, borderRadius: 8 }}>
        This text was prepared from a template and describes what the product actually does today. It is not legal advice and
        has not been reviewed by a lawyer.
      </p>
      {children}
    </main>
  );
}
