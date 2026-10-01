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
            <p>Personalized outing recommendations that actually understand what you want to do.</p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <a href="#product">Discover</a>
            <a href="#features">Recommendations</a>
            <a href="#features">Itineraries</a>
            <a href="#teams">Groups</a>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <Link href="/model-card">About</Link>
            <a href="mailto:hello@nearby.co">Contact</a>
            <a href="#pricing">Careers</a>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <Link href="/model-card">Model Card</Link>
            <a href="#faq">FAQ</a>
            <Link href="/model-card">Documentation</Link>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Nearby & Co. All rights reserved.</span>
          <span>Built for people who hate deciding where to go.</span>
        </div>
      </div>
    </footer>
  );
}
