import Link from "next/link";
import "./globals.css";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";
import ServiceWorkerRegistration from "./components/ServiceWorkerRegistration";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nearby & Co. — Outing Concierge",
  description: "A private booking desk for wherever you're headed tonight.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${mono.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f766e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Nearby" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
        <footer style={{ textAlign: "center", padding: "2.25rem 1rem", fontSize: "0.82rem", color: "var(--on-paper-muted)", borderTop: "1px solid var(--hairline-paper)", background: "var(--surface-soft)" }}>
          <Link href="/">Home</Link>
          {" · "}
          <Link href="/planner">Planner</Link>
          {" · "}
          <Link href="/model-card">Model Card</Link>
          {" · "}
          <Link href="/privacy">Privacy Policy</Link>
          {" · "}
          <Link href="/terms">Terms of Service</Link>
          {" · "}
          <span>Venue data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors (ODbL)</span>
        </footer>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
