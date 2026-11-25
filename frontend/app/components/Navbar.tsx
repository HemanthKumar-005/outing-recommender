"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface NavbarProps {
  /** Currently active navigation section for visual indication */
  activePage?: "home" | "how-it-works" | "planner" | "none";
  /** Explicit authentication status override; if omitted, checks /api/session */
  authenticated?: boolean | null;
  /** Custom logout callback (e.g. from planner state) */
  onLogout?: () => void;
}

/**
 * Unified Brand Navigation Bar for Nearby & Co.
 *
 * Implements:
 * 1. Clickable official brand logo & brand name at extreme top-left with accessible label "Nearby & Co. Home".
 * 2. Consistent navigation items: Home (/), How it Works (/model-card), Planner (/planner), and Log out / Sign in.
 * 3. Clear active state highlights and hover/focus transitions.
 * 4. Confirmation on destructive actions (Log out).
 * 5. Full responsiveness with mobile drawer for small screens.
 */
export default function Navbar({
  activePage = "none",
  authenticated: propAuthenticated = null,
  onLogout,
}: NavbarProps) {
  const router = useRouter();
  const [internalAuth, setInternalAuth] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // If authenticated was explicitly passed, respect it; otherwise check session API
  useEffect(() => {
    if (propAuthenticated !== null) {
      setInternalAuth(propAuthenticated);
      return;
    }
    let isMounted = true;
    fetch("/api/session")
      .then((r) => r.json())
      .then((data) => {
        if (isMounted) {
          setInternalAuth(Boolean(data?.authenticated));
        }
      })
      .catch(() => {
        if (isMounted) setInternalAuth(false);
      });
    return () => {
      isMounted = false;
    };
  }, [propAuthenticated]);

  const isAuthenticated = propAuthenticated !== null ? propAuthenticated : internalAuth;

  function handleLogoutClick(e: React.MouseEvent) {
    e.preventDefault();
    const confirmed = window.confirm("Are you sure you want to log out of Nearby & Co.?");
    if (!confirmed) return;

    if (onLogout) {
      onLogout();
    } else {
      fetch("/api/session", { method: "DELETE" })
        .catch(() => {})
        .finally(() => {
          router.push("/login");
          router.refresh();
        });
    }
  }

  return (
    <header className="app-navbar-wrapper">
      <nav className="app-navbar" aria-label="Main Application Navigation">
        {/* 1. Official Clickable Brand Logo & Name (Top-Left) */}
        <Link
          href="/"
          className="brand-logo-link"
          aria-label="Nearby & Co. Home"
          title="Nearby & Co. Home — Outing Discovery & Planning"
        >
          <div className="navbar-brand-logo" aria-hidden="true">
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="navbar-brand-svg"
            >
              <rect width="36" height="36" rx="9" fill="url(#navbarBrandGrad)" />
              {/* Monogram 'N' + Waypoint Dot */}
              <path
                d="M11 25V11L25 25V11"
                stroke="#FFFFFF"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="25" cy="11" r="2.5" fill="#F8DCCB" />
              <defs>
                <linearGradient id="navbarBrandGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#087F73" />
                  <stop offset="1" stopColor="#13A89E" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="navbar-brand-text">
            <span className="navbar-brand-name">Nearby &amp; Co.</span>
            <span className="navbar-brand-tagline">Discover · Explore · Experience</span>
          </div>
        </Link>

        {/* 2. Desktop Navigation Items */}
        <div className="navbar-desktop-links" role="menubar">
          <Link
            href="/"
            className={`navbar-link ${activePage === "home" ? "active" : ""}`}
            role="menuitem"
            aria-current={activePage === "home" ? "page" : undefined}
          >
            Home
          </Link>
          <Link
            href="/model-card"
            className={`navbar-link ${activePage === "how-it-works" ? "active" : ""}`}
            role="menuitem"
            aria-current={activePage === "how-it-works" ? "page" : undefined}
          >
            How it Works
          </Link>
          <Link
            href="/planner"
            className={`navbar-link ${activePage === "planner" ? "active" : ""}`}
            role="menuitem"
            aria-current={activePage === "planner" ? "page" : undefined}
          >
            Planner
          </Link>

          {/* Authentication Actions */}
          {isAuthenticated ? (
            <button
              type="button"
              className="navbar-logout-btn"
              onClick={handleLogoutClick}
              role="menuitem"
              title="End your active session"
            >
              Log out
            </button>
          ) : (
            <>
              <Link href="/login" className="navbar-link navbar-ghost-link" role="menuitem">
                Sign in
              </Link>
              <Link href="/planner" className="navbar-cta-btn" role="menuitem">
                <span>Plan Your Outing</span>
                <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button
          type="button"
          className="navbar-mobile-toggle"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
          aria-controls="navbar-mobile-menu"
        >
          <span className="navbar-hamburger-line" />
          <span className="navbar-hamburger-line" />
          <span className="navbar-hamburger-line" />
        </button>
      </nav>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div id="navbar-mobile-menu" className="navbar-mobile-drawer fade-in">
          <Link
            href="/"
            className={`navbar-mobile-link ${activePage === "home" ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Home
          </Link>
          <Link
            href="/model-card"
            className={`navbar-mobile-link ${activePage === "how-it-works" ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            How it Works
          </Link>
          <Link
            href="/planner"
            className={`navbar-mobile-link ${activePage === "planner" ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Planner
          </Link>

          {isAuthenticated ? (
            <button
              type="button"
              className="navbar-mobile-link navbar-mobile-logout"
              onClick={(e) => {
                setMobileMenuOpen(false);
                handleLogoutClick(e);
              }}
            >
              Log out
            </button>
          ) : (
            <>
              <Link
                href="/login"
                className="navbar-mobile-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign in
              </Link>
              <Link
                href="/planner"
                className="navbar-mobile-cta"
                onClick={() => setMobileMenuOpen(false)}
              >
                Plan Your Outing →
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
