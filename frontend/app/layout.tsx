import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://nearby-and-co.com"),
  title: "Nearby & Co. — Find Outings You'll Actually Love",
  description:
    "Personalized outing recommendations based on your preferences, location, budget, weather, reviews, and who you're going with. Stop wondering where to go.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Nearby & Co. — Find Outings You'll Actually Love",
    description:
      "Personalized outing recommendations based on preferences, location, budget, weather, and group taste.",
    type: "website",
    siteName: "Nearby & Co.",
    images: ["/icon.svg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nearby & Co. — Find Outings You'll Actually Love",
    description:
      "Personalized outing recommendations based on preferences, location, budget, weather, and group taste.",
    images: ["/icon.svg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('nearby-theme');
                  var theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}