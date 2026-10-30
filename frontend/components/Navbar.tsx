"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Icons } from "./Icons";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nearby-theme") as "dark" | "light" | null;
      const preferred = saved || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
      setTheme(preferred);
      document.documentElement.setAttribute("data-theme", preferred);
    } catch {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("nearby-theme", next);
    } catch {
      /* ignore storage failure */
    }
  };

  const links = [
    { href: "#demo", label: "Product" },
    { href: "#how-it-works", label: "How it works" },
    { href: "#features", label: "Features" },
    { href: "#teams", label: "For teams" },
    { href: "#pricing", label: "Pricing" },
  ];

  return (
    <header className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="container navbar-inner">
        <Link href="/" className="logo">
          <span className="logo-mark">N</span>
          Nearby &amp; Co.
        </Link>
        <nav className="nav-links">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="nav-link">{l.label}</a>
          ))}
        </nav>
        <div className="nav-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Icons.Sun size={17} /> : <Icons.Moon size={17} />}
          </button>
          <Link href="/dashboard" className="btn btn-primary btn-sm">
            Dashboard <Icons.ArrowUpRight size={14} style={{ marginLeft: 2 }} />
          </Link>
          <button
            type="button"
            className="nav-toggle"
            aria-label="Toggle navigation menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <Icons.Close size={18} /> : <Icons.Menu size={20} />}
          </button>
        </div>
      </div>
      <div className={`mobile-menu ${open ? "open" : ""}`}>
        {links.map((l) => (
          <a key={l.href} href={l.href} className="nav-link" onClick={() => setOpen(false)}>{l.label}</a>
        ))}
        <div className="mobile-menu-actions">
          <Link href="/dashboard" className="btn btn-primary btn-block" onClick={() => setOpen(false)}>
            Dashboard <Icons.ArrowUpRight size={14} style={{ marginLeft: 4 }} />
          </Link>
        </div>
      </div>
    </header>
  );
}
