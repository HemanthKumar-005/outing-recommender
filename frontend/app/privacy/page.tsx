import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <main className="page">
      <div className="top-row">
        <div>
          <p className="eyebrow">Nearby &amp; Co. · Legal</p>
          <h1>Privacy Policy</h1>
          <p className="subtitle">
            How we collect, use, and protect your information under the Digital Personal Data Protection (DPDP) Act 2023 and the General Data Protection Regulation (GDPR).
          </p>
        </div>
        <Link href="/" className="btn-secondary" style={{ textDecoration: "none" }}>
          ← Back to home
        </Link>
      </div>

      <div className="card fade-in" style={{ lineHeight: "1.7", fontSize: "0.95rem" }}>
        <h2>1. Scope &amp; Purpose</h2>
        <p>
          Nearby &amp; Co. (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) provides context-aware outing recommendations. This Privacy Policy details how we handle personal data collected through our web applications, API services, and associated tools.
        </p>

        <h2>2. Data We Collect</h2>
        <ul>
          <li><strong>Identity &amp; Contact:</strong> Name and email address provided during registration.</li>
          <li><strong>Outing Preferences:</strong> Budget tiers, category interests, ambience preferences, and preferred outing types (e.g. friends, couple, family, solo).</li>
          <li><strong>Location Information:</strong> Precise coordinates (latitude and longitude) collected <em>only when you explicitly click &quot;Use my location&quot; and grant permission</em>. We use coordinates in real time to query nearby venues and do not store continuous location tracks.</li>
          <li><strong>Interaction History:</strong> Places you view, save, like, skip, or rate, utilized to calibrate our recommendation scoring models.</li>
        </ul>

        <h2>3. How We Use Your Data</h2>
        <p>
          Your data is used solely to generate personalized venue recommendations, schedule multi-stop itineraries, and send event reminders. <strong>We do not sell, rent, or trade your personal data to data brokers or third-party advertisers.</strong>
        </p>

        <h2>4. Data Retention</h2>
        <p>
          Interaction data is retained for up to 12 months for algorithmic refinement and model evaluation. Account profile data is maintained only while your account remains active. Upon requesting account deletion, all associated personal records are immediately and permanently erased.
        </p>

        <h2>5. Your Rights &amp; Account Deletion</h2>
        <p>
          Under the Indian <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong> and <strong>GDPR Chapter III</strong>, you hold the right to access, rectify, and completely erase your personal data. You may execute full data erasure at any time via the <strong>&quot;Delete my account&quot;</strong> button in your dashboard or by sending a request to our Data Protection Officer.
        </p>

        <h2>6. Third-Party Attribution &amp; External Services</h2>
        <p>
          Our venue catalog incorporates geospatial data provided by OpenStreetMap contributors under the Open Database Licence (ODbL). Weather context is retrieved in real-time from open meteorological services without transmitting identifying personal data.
        </p>

        <h2>7. Contact Us</h2>
        <p>
          For privacy inquiries, grievance redressal, or data erasure requests, please contact our privacy desk at:{" "}
          <a href="mailto:privacy@nearby.example" style={{ color: "var(--accent)" }}>
            privacy@nearby.example
          </a>.
        </p>

        <hr style={{ margin: "2rem 0", borderColor: "var(--paper-subtle)" }} />
        <Link href="/" className="btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Return to Concierge
        </Link>
      </div>
    </main>
  );
}
