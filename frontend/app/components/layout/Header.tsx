"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import UserMenu from "./UserMenu";

export default function Header() {
  const pathname = usePathname();
  const { status, isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Subtle header shadow on scroll
  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 15);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Do not render global header on dedicated split-screen auth viewports
  if (pathname === "/login" || pathname === "/signup") {
    return null;
  }

  const isLandingPage = pathname === "/";
  const isPlanner = pathname === "/planner";

  return (
    <header className={`site-header ${scrolled ? "scrolled" : ""} ${isPlanner ? "planner-header-mode" : ""}`}>
      <div className="site-header-container">
        {/* Brand Logo & Name */}
        <Link href="/" className="site-brand" aria-label="Nearby & Co. Homepage">
          <div className="site-brand-logo" aria-hidden="true">
            N
          </div>
          <div className="site-brand-text">
            <span className="site-brand-name">Nearby &amp; Co.</span>
            <span className="site-brand-tagline">Discover · Explore · Experience</span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="site-nav" aria-label="Main Navigation">
          {isLandingPage ? (
            <>
              <a href="#how-it-works" className="site-nav-link">
                How It Works
              </a>
              <a href="#preview" className="site-nav-link">
                Discover Places
              </a>
              <a href="#budget" className="site-nav-link">
                Budget Matching
              </a>
              <a href="#travel" className="site-nav-link">
                Travel-Smart
              </a>
              <a href="#faq" className="site-nav-link">
                FAQ
              </a>
            </>
          ) : (
            <>
              <Link href="/" className={`site-nav-link ${pathname === "/" ? "active" : ""}`}>
                Home
              </Link>
              <Link href="/planner" className={`site-nav-link ${pathname === "/planner" ? "active" : ""}`}>
                Planner
              </Link>
              <Link href="/model-card" className={`site-nav-link ${pathname === "/model-card" ? "active" : ""}`}>
                How it works
              </Link>
            </>
          )}
        </nav>

        {/* Authentication Controls */}
        <div className="site-auth-actions">
          {isLoading ? (
            <div className="site-auth-skeleton" aria-hidden="true" />
          ) : isAuthenticated ? (
            <div className="site-auth-logged-in">
              {!isPlanner && (
                <Link href="/planner" className="site-planner-btn">
                  Open Planner →
                </Link>
              )}
              <UserMenu />
            </div>
          ) : (
            <div className="site-auth-logged-out">
              <Link href="/login" className="site-login-btn">
                Log in
              </Link>
              <Link href="/login?mode=register" className="site-signup-btn">
                Sign up
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            className={`site-mobile-toggle ${mobileMenuOpen ? "open" : ""}`}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            <span className="hamburger-line" />
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="site-mobile-drawer fade-in">
          <nav className="site-mobile-nav">
            <Link href="/" className="site-mobile-link" onClick={() => setMobileMenuOpen(false)}>
              Home
            </Link>
            <Link href="/planner" className="site-mobile-link" onClick={() => setMobileMenuOpen(false)}>
              Outing Planner
            </Link>
            <Link href="/model-card" className="site-mobile-link" onClick={() => setMobileMenuOpen(false)}>
              How It Works
            </Link>
            {isLandingPage && (
              <>
                <a href="#preview" className="site-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  Discover Places
                </a>
                <a href="#budget" className="site-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  Budget Matching
                </a>
                <a href="#faq" className="site-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  FAQ
                </a>
              </>
            )}
            {isAuthenticated && (
              <Link href="/profile" className="site-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                Profile &amp; Preferences
              </Link>
            )}
          </nav>

          <div className="site-mobile-auth">
            {isLoading ? (
              <div className="site-auth-skeleton" />
            ) : isAuthenticated ? (
              <div className="site-mobile-user-row">
                <UserMenu />
              </div>
            ) : (
              <div className="site-mobile-auth-btns">
                <Link
                  href="/login"
                  className="site-login-btn"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  href="/login?mode=register"
                  className="site-signup-btn"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
