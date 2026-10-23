import LegalPage, { ContactLine } from "../../components/LegalPage";
import { TERMS_VERSION } from "../../lib/site";

export const metadata = { title: "Terms of Service – Nearby & Co." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={TERMS_VERSION}>
      <h2>1. The service is a beta</h2>
      <p>Nearby &amp; Co. is free, early-access software provided &quot;as is&quot;, without warranties. It may change, break or be withdrawn at any time.</p>

      <h2>2. Information may be wrong</h2>
      <p>Venue details (opening hours, prices, whether a place still exists) come from public sources and estimates. Where hours or prices are estimates we label them &quot;Estimated — verify ahead&quot;. Always confirm with the venue before you travel. You use recommendations at your own risk; we are not responsible for closed venues, changed prices, weather, travel conditions or your safety.</p>

      <h2>3. Your account</h2>
      <p>You must be 18 or over. Keep your password private and tell us if you suspect misuse. You may delete your account at any time in Settings.</p>

      <h2>4. Acceptable use</h2>
      <p>Do not attack, overload or scrape the service, bypass its security or captcha, or use it for anything unlawful. We may suspend accounts that do.</p>

      <h2>5. Map and place data</h2>
      <p>Map data © OpenStreetMap contributors, available under the Open Database Licence (ODbL).</p>

      <h2>6. Liability</h2>
      <p>To the extent permitted by law, the operator is not liable for indirect or consequential loss arising from use of the service.</p>

      <h2>7. Contact</h2>
      <p><ContactLine /></p>
    </LegalPage>
  );
}
