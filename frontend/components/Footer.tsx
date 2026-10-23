import Link from "next/link";
<<<<<<< HEAD
import { SUPPORT_EMAIL } from "../lib/site";
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="logo">
              <span className="logo-mark">N</span>
              Nearby & Co.
            </Link>
            <p>A better way to decide where to go next.</p>
          </div>
          <div className="footer-col">
            <h4>Explore</h4>
            <a href="#demo">Product</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="footer-col">
            <h4>For teams</h4>
            <a href="#teams">API access</a>
            <Link href="/model-card">Model card</Link>
            <Link href="/signup">Get started</Link>
          </div>
          <div className="footer-col">
            <h4>Account</h4>
            <Link href="/login">Log in</Link>
            <Link href="/signup">Sign up</Link>
          </div>
<<<<<<< HEAD
          <div className="footer-col">
            <h4>Legal &amp; help</h4>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            {SUPPORT_EMAIL && <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Nearby & Co.</span>
          <span>
            Beta · venue details may be estimates · Map data ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>
          </span>
=======
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Nearby & Co.</span>
          <span>Made for better plans.</span>
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
        </div>
      </div>
    </footer>
  );
}
