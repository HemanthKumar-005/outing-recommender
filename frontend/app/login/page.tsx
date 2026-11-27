"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshSession } = useAuth();

  // Mode: "signin" | "register"
  const initialMode = searchParams.get("mode") === "register" ? "register" : "signin";
  const [mode, setMode] = useState<"signin" | "register">(initialMode);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Auto-redirect if already logged in
  useEffect(() => {
    let isMounted = true;
    async function checkSession() {
      try {
        const resp = await fetch("/api/session");
        if (resp.ok) {
          const data = await resp.json();
          if (data.authenticated && isMounted) {
            router.push("/planner");
          }
        }
      } catch {
        // If session check fails, stay on login page
      }
    }
    checkSession();
    return () => {
      isMounted = false;
    };
  }, [router]);

  // Handle mode switch cleanly
  function handleModeSwitch(newMode: "signin" | "register") {
    setMode(newMode);
    setError(null);
    setSuccessMsg(null);
    setConfirmPassword("");
  }

  // Real-time validations
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isPasswordValid = password.length >= 6;
  const doPasswordsMatch = password === confirmPassword;

  // Submit button disabled condition
  const isSubmitDisabled =
    loading ||
    !email.trim() ||
    !password ||
    (mode === "register" && (!name.trim() || !isPasswordValid || !doPasswordsMatch));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Basic client validations
    if (!isEmailValid) {
      setError("Please enter a valid email address.");
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (!isPasswordValid) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (!doPasswordsMatch) {
        setError("Passwords do not match. Please re-enter your password.");
        return;
      }
    }

    setLoading(true);

    try {
      const payload: Record<string, string> = {
        email: email.trim(),
        password,
      };

      if (mode === "register") {
        payload.action = "register";
        payload.name = name.trim();
      }

      const resp = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        if (resp.status === 409 || data.error?.toLowerCase().includes("already exists")) {
          setError("An account with this email address already exists. Please sign in instead.");
        } else if (resp.status === 401) {
          setError("Invalid email or password. Please verify your credentials or create an account.");
        } else {
          setError(data.error || "Authentication failed. Please try again.");
        }
        return;
      }

      setSuccessMsg(mode === "register" ? "Account created! Redirecting to planner..." : "Welcome back! Redirecting...");
      await refreshSession();
      router.push("/planner");
      router.refresh();
    } catch {
      setError("Unable to connect to the authentication service. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-viewport">
      <div className="auth-shell fade-in">
        {/* ==================================================================
            Left Showcase Panel (Visual Experience & Product Identity)
            ================================================================== */}
        <section className="auth-showcase">
          <div className="auth-showcase-content">
            {/* Brand Header */}
            <div className="auth-brand-row">
              <div className="auth-brand-badge" aria-hidden="true">
                N
              </div>
              <div>
                <span className="auth-brand-name">Nearby &amp; Co.</span>
                <span className="auth-brand-tagline">Discover More. Experience Better.</span>
              </div>
            </div>

            {/* Headline */}
            <h1 className="auth-hero-title">
              Your next great outing <em>starts here.</em>
            </h1>
            <p className="auth-hero-desc">
              Discover amazing places, plan memorable experiences, and find the perfect spots for every occasion.
            </p>

            {/* Value Pillars */}
            <div className="auth-pillars">
              <div className="auth-pillar-item">
                <div className="auth-pillar-icon" aria-hidden="true">
                  🌿
                </div>
                <div className="auth-pillar-text">
                  <strong>Discover places worth exploring</strong>
                  <span>Curated microbreweries, specialty cafes, scenic gardens, and cultural landmarks.</span>
                </div>
              </div>

              <div className="auth-pillar-item">
                <div className="auth-pillar-icon" aria-hidden="true">
                  🎯
                </div>
                <div className="auth-pillar-text">
                  <strong>Tailored to your interests</strong>
                  <span>Personalized matches based on outing vibe, group tastes, weather, and budget.</span>
                </div>
              </div>

              <div className="auth-pillar-item">
                <div className="auth-pillar-icon" aria-hidden="true">
                  🛣️
                </div>
                <div className="auth-pillar-text">
                  <strong>Smart road routing</strong>
                  <span>Accurate road driving and walking times calculated from your exact starting point.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof Strip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              background: "rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              borderRadius: "999px",
              border: "1px solid rgba(255, 255, 255, 0.22)",
              width: "fit-content",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", marginLeft: "6px" }}>
              <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#13A89E", display: "inline-block", border: "2px solid #14332e", marginRight: "-8px" }} />
              <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#d96b43", display: "inline-block", border: "2px solid #14332e", marginRight: "-8px" }} />
              <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#087F73", display: "inline-block", border: "2px solid #14332e" }} />
            </div>
            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#ffffff", paddingRight: "8px" }}>
              Joined by 2,400+ explorers in Bengaluru
            </span>
          </div>

          {/* Floating Spot Card Preview */}
          <div className="auth-preview-badge">
            <div className="auth-preview-badge-left">
              <div className="auth-preview-avatar" aria-hidden="true" />
              <div>
                <div className="auth-preview-name">Toit Brewpub · Indiranagar</div>
                <div className="auth-preview-sub">★ 4.7 (620 reviews) · ~16 mins driving</div>
              </div>
            </div>
            <span className="auth-preview-pill">95% Match</span>
          </div>
        </section>

        {/* ==================================================================
            Right Authentication Form (ChatGPT-inspired Simplicity & Focus)
            ================================================================== */}
        <section className="auth-form-side">
          {/* Top Navigation */}
          <div className="auth-top-nav">
            <Link href="/" className="auth-back-link">
              ← Home
            </Link>
            <Link href="/signup" className="auth-workspace-link" title="Provision a multi-tenant business workspace">
              Workspace setup →
            </Link>
          </div>

          {/* Form Container */}
          <div className="auth-card-body">
            {/* Segmented Mode Switcher */}
            <div className="auth-tabs" role="tablist" aria-label="Authentication Options">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                className={`auth-tab-btn ${mode === "signin" ? "active" : ""}`}
                onClick={() => handleModeSwitch("signin")}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={`auth-tab-btn ${mode === "register" ? "active" : ""}`}
                onClick={() => handleModeSwitch("register")}
              >
                Create Account
              </button>
            </div>

            {/* Header Titles */}
            <div className="auth-card-header">
              <h2 className="auth-card-title">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
              <p className="auth-card-subtitle">
                {mode === "signin"
                  ? "Sign in to continue planning your next outing."
                  : "Join Nearby & Co. and start discovering places worth exploring."}
              </p>
            </div>

            {/* Form */}
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {/* Full Name Field (Register only) */}
              {mode === "register" && (
                <div className="auth-field fade-in">
                  <label htmlFor="auth-name" className="auth-field-label">
                    Full Name
                  </label>
                  <div className="auth-input-container">
                    <span className="auth-input-icon" aria-hidden="true">
                      👤
                    </span>
                    <input
                      id="auth-name"
                      className="auth-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Smith"
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email Address */}
              <div className="auth-field">
                <label htmlFor="auth-email" className="auth-field-label">
                  Email address
                </label>
                <div className="auth-input-container">
                  <span className="auth-input-icon" aria-hidden="true">
                    ✉️
                  </span>
                  <input
                    id="auth-email"
                    className={`auth-input ${email && !isEmailValid ? "has-error" : ""}`}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="auth-field">
                <div className="auth-field-label">
                  <label htmlFor="auth-password">Password</label>
                  {mode === "register" && (
                    <span style={{ fontSize: "0.72rem", color: "var(--on-paper-muted)", fontWeight: "normal" }}>
                      Min. 6 characters
                    </span>
                  )}
                </div>
                <div className="auth-input-container">
                  <span className="auth-input-icon" aria-hidden="true">
                    🔒
                  </span>
                  <input
                    id="auth-password"
                    className="auth-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder={mode === "register" ? "Create a secure password" : "••••••••"}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    required
                  />
                  <button
                    type="button"
                    className="auth-toggle-pwd"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Confirm Password (Register only) */}
              {mode === "register" && (
                <div className="auth-field fade-in">
                  <label htmlFor="auth-confirm-password" className="auth-field-label">
                    Confirm Password
                  </label>
                  <div className="auth-input-container">
                    <span className="auth-input-icon" aria-hidden="true">
                      🔒
                    </span>
                    <input
                      id="auth-confirm-password"
                      className={`auth-input ${confirmPassword && !doPasswordsMatch ? "has-error" : ""}`}
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-toggle-pwd"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? "🙈" : "👁️"}
                    </button>
                  </div>

                  {confirmPassword && (
                    <div className={`auth-match-indicator ${doPasswordsMatch ? "valid" : "invalid"}`}>
                      {doPasswordsMatch ? "✓ Passwords match" : "✕ Passwords must match"}
                    </div>
                  )}
                </div>
              )}

              {/* Error Message Alert */}
              {error && (
                <div className="auth-alert-banner" role="alert">
                  <span className="auth-alert-icon" aria-hidden="true">
                    ⚠️
                  </span>
                  <div>{error}</div>
                </div>
              )}

              {/* Success Message Banner */}
              {successMsg && (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#166534",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "0.84rem",
                  }}
                  role="status"
                >
                  ✓ {successMsg}
                </div>
              )}

              {/* Submit Action Button */}
              <button type="submit" className="auth-submit-btn btn-shimmer" disabled={isSubmitDisabled}>
                {loading ? (
                  <>
                    <span className="auth-spinner" aria-hidden="true" />
                    <span>{mode === "register" ? "Creating account..." : "Signing in..."}</span>
                  </>
                ) : (
                  <span>{mode === "register" ? "Create Account →" : "Continue →"}</span>
                )}
              </button>
            </form>

            {/* Switch Prompt */}
            <div className="auth-switch-prompt">
              {mode === "signin" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button type="button" className="auth-switch-action" onClick={() => handleModeSwitch("register")}>
                    Create one
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button type="button" className="auth-switch-action" onClick={() => handleModeSwitch("signin")}>
                    Sign in
                  </button>
                </>
              )}
            </div>

            {/* Legal Footnote */}
            <p className="auth-legal-note">
              By continuing, you agree to Nearby &amp; Co.&apos;s{" "}
              <Link href="/terms">Terms of Service</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
