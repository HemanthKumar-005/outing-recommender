"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getUserInfo, logoutUser } from "../lib/api";
import { Icons } from "./Icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: Icons.Dashboard },
  { href: "/dashboard/discover", label: "Discover", Icon: Icons.Discover },
  { href: "/dashboard/date-planner", label: "Date Planner", Icon: Icons.DatePlanner },
  { href: "/dashboard/recommendations", label: "Recommendations", Icon: Icons.Recommendations },
  { href: "/dashboard/saved", label: "Saved Places", Icon: Icons.Saved },
  { href: "/dashboard/itineraries", label: "Itineraries", Icon: Icons.Itineraries },
  { href: "/dashboard/groups", label: "Group Consensus", Icon: Icons.Groups },
  { href: "/dashboard/activity", label: "Activity", Icon: Icons.Activity },
  { href: "/dashboard/settings", label: "Settings", Icon: Icons.Settings },
];

type Props = {
  open?: boolean;
  onClose?: () => void;
};

export default function DashboardSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUserInfo();
  const initial = (user.name || "U").charAt(0).toUpperCase();

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("nearby-theme") as "dark" | "light" | null;
      const preferred = savedTheme || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
      setTheme(preferred);
      document.documentElement.setAttribute("data-theme", preferred);

      const savedCollapsed = localStorage.getItem("nearby-sidebar-collapsed") === "true";
      setCollapsed(savedCollapsed);
    } catch {
      setTheme("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("nearby-theme", next);
    } catch {
      /* ignore */
    }
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("nearby-sidebar-collapsed", String(next));
    } catch {
      /* ignore */
    }
  };

  const logout = async () => {
    await logoutUser();
    router.push("/");
  };

  return (
    <aside className={`dash-sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
      {/* Brand Header */}
      <div className="dash-sidebar-brand" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/dashboard" className="logo" onClick={onClose} title="Nearby & Co.">
          <span className="logo-mark">N</span>
          {!collapsed && <span>Nearby &amp; Co.</span>}
        </Link>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Icons.ArrowRight size={14} /> : <Icons.Menu size={16} />}
        </button>
      </div>

      {/* Navigation items */}
      <nav className="dash-nav" aria-label="Dashboard sidebar navigation">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const IconComp = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`dash-nav-link ${active ? "active" : ""}`}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
            >
              <span className="dash-nav-icon">
                <IconComp size={18} />
              </span>
              {!collapsed && <span className="dash-nav-text">{item.label}</span>}
              {active && <span className="dash-nav-active-pip" />}
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="dash-user">
        <div className="dash-avatar" title={user.name}>{initial}</div>
        {!collapsed && (
          <div className="dash-user-info">
            <div className="dash-user-name">{user.name}</div>
            <div className="dash-user-workspace">{user.email}</div>
          </div>
        )}
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Icons.Sun size={15} /> : <Icons.Moon size={15} />}
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={logout}
            title="Log out"
            aria-label="Log out"
          >
            <Icons.Logout size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
