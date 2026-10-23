import LegalPage, { ContactLine } from "../../components/LegalPage";
import { TERMS_VERSION } from "../../lib/site";

export const metadata = { title: "Privacy Policy – Nearby & Co." };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={TERMS_VERSION}>
      <h2>Who we are</h2>
      <p>Nearby &amp; Co. is a free beta that recommends outings in India. The operator is the data fiduciary for the purposes of India&apos;s Digital Personal Data Protection Act, 2023 (DPDP Act). Contact / grievance officer: <ContactLine />.</p>

      <h2>What we collect, and why</h2>
      <ul>
        <li><strong>Account data</strong>: name, email address, a salted Argon2id hash of your password (we never store the password itself). Purpose: to create and secure your account.</li>
        <li><strong>Preferences you enter</strong>: categories, occasions, budget, ambience, distance. Purpose: to personalise recommendations.</li>
        <li><strong>Activity</strong>: places you view, save, like or dismiss, and plans you generate. Purpose: to improve your recommendations and to show your history.</li>
        <li><strong>Location</strong>: the city or area you choose in the app, sent with your request to find nearby places. Today the app does not read your device's GPS location. If we add that, it will be off until you turn on &quot;Use my location&quot; in Settings, and we will not keep a location history.</li>
        <li><strong>Technical data</strong>: IP address and request logs, kept for security and debugging for a limited period.</li>
        <li><strong>Consent records</strong>: when you accepted these terms and when you turned location on or off.</li>
      </ul>

      <h2>Who else sees data</h2>
      <p>We do not sell your data and show no ads. To run the service we rely on these providers, which receive only what they need:</p>
      <ul>
        <li><strong>Hosting and network</strong> providers (servers, database, Cloudflare for DNS/TLS/captcha).</li>
        <li><strong>OpenStreetMap tile servers</strong>: your browser requests map images directly, so they see your IP address and the map area you view.</li>
        <li><strong>Weather (Open-Meteo / OpenWeatherMap)</strong> and <strong>routing (OSRM / LocationIQ)</strong>: approximate coordinates of the places in your request, without your name or email.</li>
        <li><strong>Email delivery provider</strong>: your email address, to send the confirmation link.</li>
        <li><strong>Cloudflare Turnstile</strong>: a captcha check on sign-up and login.</li>
      </ul>

      <h2>Your rights</h2>
      <p>You can access, correct and erase your data. Use <em>Settings → Delete account</em> to permanently delete your profile, activity, saved plans and notifications. Email <ContactLine /> for any other request or complaint; we aim to respond within 30 days. If you are unhappy with our response you may approach the Data Protection Board of India once it is operational.</p>

      <h2>Retention and security</h2>
      <p>Account data is kept until you delete your account. Passwords are hashed, sessions use HttpOnly cookies, and each user&apos;s data is separated at the database level. No system is perfectly secure; if a breach affects you we will tell you and the authorities as the law requires.</p>

      <h2>Children</h2>
      <p>The service is for people aged 18 and over. Do not sign up if you are younger.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we will update the version above and ask you to accept it again.</p>
    </LegalPage>
  );
}
