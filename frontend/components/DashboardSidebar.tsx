"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getUserInfo, clearSession } from "../lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/dashboard/discover", label: "Discover", icon: "◎" },
  { href: "/dashboard/date-planner", label: "Date Planner", icon: "♥" },
  { href: "/dashboard/recommendations", label: "Recommendations", icon: "★" },
  { href: "/dashboard/saved", label: "Saved Places", icon: "♡" },
  { href: "/dashboard/itineraries", label: "Itineraries", icon: "☰" },
  { href: "/dashboard/groups", label: "Groups", icon: "☺" },
  { href: "/dashboard/activity", label: "Activity", icon: "◌" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

type Props = { open?: boolean; onClose?: () => void };

export default function DashboardSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUserInfo();
  const initial = (user.name || "U").charAt(0).toUpperCase();

  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("nearby-theme") as "dark" | "light" | null;
    const preferred = saved || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setTheme(preferred);
    document.documentElement.setAttribute("data-theme", preferred);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("nearby-theme", next);
  };

  const logout = () => {
    clearSession();
    router.push("/");
  };

  return (
    <aside className={`dash-sidebar ${open ? "open" : ""}`}>
      <div className="dash-sidebar-brand">
        <Link href="/dashboard" className="logo" onClick={onClose}>
          <span className="logo-mark">N</span>
          Nearby & Co.
        </Link>
      </div>
      <nav className="dash-nav">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`dash-nav-link ${active ? "active" : ""}`}
              onClick={onClose}
            >
              <span className="dash-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="dash-user">
        <div className="dash-avatar">{initial}</div>
        <div className="dash-user-info">
          <div className="dash-user-name">{user.name}</div>
          <div className="dash-user-workspace">{user.workspace}</div>
        </div>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          style={{ fontSize: "1rem" }}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={logout} title="Log out">
          ⎋
        </button>
      </div>
    </aside>
  );
}
