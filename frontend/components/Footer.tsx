import Link from "next/link";

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
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Nearby & Co.</span>
          <span>Made for better plans.</span>
        </div>
      </div>
    </footer>
  );
}
