"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return "U";
}

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  const initials = getInitials(user.name, user.email);
  const displayName = user.name || user.email.split("@")[0] || "User";

  async function handleLogout() {
    setIsLoggingOut(true);
    setIsOpen(false);
    await logout();
    setIsLoggingOut(false);
  }

  return (
    <div className="user-menu-wrapper" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`user-menu-trigger ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="User account menu"
      >
        <div className="user-menu-avatar" aria-hidden="true">
          {user.avatar ? (
            <img src={user.avatar} alt={displayName} className="user-menu-avatar-img" />
          ) : (
            <span className="user-menu-avatar-initials">{initials}</span>
          )}
        </div>
        <span className="user-menu-name">{displayName}</span>
        <svg
          className={`user-menu-chevron ${isOpen ? "rotate" : ""}`}
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="user-dropdown-card" role="menu" aria-orientation="vertical">
          {/* User Profile Summary Header */}
          <div className="user-dropdown-header">
            <div className="user-dropdown-avatar" aria-hidden="true">
              {user.avatar ? (
                <img src={user.avatar} alt={displayName} className="user-menu-avatar-img" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="user-dropdown-meta">
              <span className="user-dropdown-name">{displayName}</span>
              <span className="user-dropdown-email">{user.email}</span>
            </div>
          </div>

          <div className="user-dropdown-divider" />

          {/* Navigation Items */}
          <div className="user-dropdown-items">
            <Link
              href="/profile"
              className="user-dropdown-link"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Profile &amp; Preferences</span>
            </Link>

            <Link
              href="/planner"
              className="user-dropdown-link"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
              <span>My Planner</span>
            </Link>
          </div>

          <div className="user-dropdown-divider" />

          {/* Logout Action */}
          <div className="user-dropdown-footer">
            <button
              type="button"
              className="user-dropdown-logout-btn"
              role="menuitem"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
