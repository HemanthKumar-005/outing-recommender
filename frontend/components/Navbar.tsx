"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#product", label: "Product" },
    { href: "#how-it-works", label: "How It Works" },
    { href: "#features", label: "Features" },
    { href: "#teams", label: "For Teams" },
    { href: "#pricing", label: "Pricing" },
  ];

  return (
    <header className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="container navbar-inner">
        <Link href="/" className="logo">
          <span className="logo-mark">N</span>
          Nearby & Co.
        </Link>
        <nav className="nav-links">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="nav-link">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <Link href="/login" className="btn btn-secondary btn-sm">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-primary btn-sm">
            Get Started
          </Link>
          <button
            type="button"
            className="nav-toggle"
            aria-label="Menu"
            onClick={() => setOpen(!open)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>
      <div className={`mobile-menu ${open ? "open" : ""}`}>
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="nav-link"
            onClick={() => setOpen(false)}
          >
            {l.label}
          </a>
        ))}
        <Link href="/login" className="btn btn-secondary btn-block" onClick={() => setOpen(false)}>
          Log in
        </Link>
        <Link href="/signup" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
          Get Started
        </Link>
      </div>
    </header>
  );
}
