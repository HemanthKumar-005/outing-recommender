import Link from "next/link";
import "./globals.css";
import type { Metadata } from "next";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";
import { AuthProvider } from "./context/AuthContext";
import Header from "./components/layout/Header";
import ScrollProgress from "./components/ScrollProgress";
import CursorBlob from "./components/CursorBlob";

export const metadata: Metadata = {
  title: "Nearby & Co. — Outing Concierge",
  description: "A private booking desk for wherever you're headed tonight.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f766e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Nearby" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500;1,9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ScrollProgress />
        <CursorBlob />
        <AuthProvider>
          <Header />
          {children}
        </AuthProvider>
        <footer style={{ textAlign: "center", padding: "2rem clamp(20px, 3.5vw, 40px)", fontSize: "0.82rem", color: "var(--on-paper-muted)", borderTop: "1px solid var(--hairline-paper)", background: "var(--surface-soft)" }}>
          <div style={{ maxWidth: "1240px", margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "8px" }}>
            <Link href="/">Home</Link>
            <span>·</span>
            <Link href="/planner">Planner</Link>
            <span>·</span>
            <Link href="/model-card">Model Card</Link>
            <span>·</span>
            <Link href="/privacy">Privacy Policy</Link>
            <span>·</span>
            <Link href="/terms">Terms of Service</Link>
            <span>·</span>
            <span>Venue data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors (ODbL)</span>
          </div>
        </footer>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
