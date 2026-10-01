"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import DashboardSidebar from "../../components/DashboardSidebar";
import { isAuthenticated } from "../../lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="auth-page">
        <div className="skeleton" style={{ width: 200, height: 24 }} />
      </div>
    );
  }

  const mobileLinks = [
    { href: "/dashboard", label: "Home" },
    { href: "/dashboard/discover", label: "Discover" },
    { href: "/dashboard/recommendations", label: "Recs" },
    { href: "/dashboard/itineraries", label: "Plans" },
    { href: "/dashboard/settings", label: "More" },
  ];

  return (
    <div className="dash-layout">
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 150 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="dash-main">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: 16, display: "none" }}
          id="mobile-menu-btn"
          onClick={() => setSidebarOpen(true)}
        >
          ☰ Menu
        </button>
        <style>{`
          @media (max-width: 768px) {
            #mobile-menu-btn { display: inline-flex !important; }
          }
        `}</style>
        {children}
      </div>
      <nav className="mobile-dash-bar">
        {mobileLinks.map((l) => (
          <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
