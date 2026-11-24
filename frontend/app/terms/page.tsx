import Link from "next/link";

export default function TermsOfService() {
  return (
    <main className="page">
      <div className="top-row">
        <div>
          <p className="eyebrow">Nearby &amp; Co. · Legal</p>
          <h1>Terms of Service</h1>
          <p className="subtitle">
            The rules and legal terms governing your use of the Nearby &amp; Co. outing concierge platform.
          </p>
        </div>
        <Link href="/" className="btn-secondary" style={{ textDecoration: "none" }}>
          ← Back to home
        </Link>
      </div>

      <div className="card fade-in" style={{ lineHeight: "1.7", fontSize: "0.95rem" }}>
        <h2>1. The Service</h2>
        <p>
          Nearby &amp; Co. is an algorithmic outing recommendation and planning tool. <strong>We are an advisory recommendation concierge, not a booking platform, ticketing service, or venue operator.</strong> We do not issue tickets, take table reservations, or guarantee venue admission.
        </p>

        <h2>2. Venue Information &amp; Estimates</h2>
        <p>
          Venue operating hours, price ranges, ambience ratings, and weather forecasts displayed on Nearby &amp; Co. are estimates aggregated from open geospatial sources, user contributions, and public directories. Operating hours may vary due to holidays, private events, or seasonal shifts. <strong>Always verify hours, pricing, and availability directly with the establishment before visiting.</strong>
        </p>

        <h2>3. Acceptable Use</h2>
        <p>
          You agree to use Nearby &amp; Co. solely for personal, non-commercial outing planning. You agree not to:
        </p>
        <ul>
          <li>Scrape, crawl, or harvest catalog venues or ranking model parameters using automated scripts.</li>
          <li>Attempt to bypass API gateway rate limits, multi-tenant row-level security, or authorization controls.</li>
          <li>Submit malicious reviews, fraudulent interaction feedback, or impersonate other users.</li>
        </ul>

        <h2>4. Limitation of Liability</h2>
        <p>
          Recommendations are suggestions provided &quot;as is&quot; without warranties of any kind. Nearby &amp; Co. and its contributors shall not be liable for any direct, indirect, incidental, or consequential damages resulting from closed venues, inaccurate operating schedules, travel delays, cancellations, or adverse experiences at suggested places.
        </p>

        <h2>5. Intellectual Property &amp; Attribution</h2>
        <p>
          Geographic and place data contains information from OpenStreetMap, licensed under the Open Data Commons Open Database License (ODbL) by the OpenStreetMap Foundation (OSMF).
        </p>

        <h2>6. Governing Law &amp; Jurisdiction</h2>
        <p>
          These Terms are governed by and construed in accordance with the laws of <strong>India</strong>. Any disputes arising in connection with these terms shall be subject to the exclusive jurisdiction of the competent courts in <strong>Bengaluru, Karnataka, India</strong>.
        </p>

        <hr style={{ margin: "2rem 0", borderColor: "var(--paper-subtle)" }} />
        <Link href="/" className="btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Return to Concierge
        </Link>
      </div>
    </main>
  );
}
