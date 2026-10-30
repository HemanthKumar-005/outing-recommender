"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginUser, isOnboarded } from "../../lib/api";
import Turnstile from "../../components/Turnstile";
import { Icons } from "../../components/Icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await loginUser({ email: email.trim(), password, captchaToken: captcha });
      router.push(isOnboarded() ? "/dashboard" : "/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setCaptchaReset((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-layout">
      {/* Left Showcase Panel */}
      <div className="auth-gradient-panel">
        <div className="auth-panel-glow" />
        <div className="auth-panel-content">
          <Link href="/" className="logo auth-panel-logo">
            <span className="logo-mark">N</span>
            Nearby &amp; Co.
          </Link>

          <div className="auth-panel-hero">
            <span className="badge" style={{ background: "rgba(255,255,255,0.12)", color: "#fff", marginBottom: 14 }}>
              <Icons.Sparkles size={12} style={{ marginRight: 5 }} /> Instant Outing Intelligence
            </span>
            <h2>
              Stop debating.
              <br />
              <span className="hero-italic" style={{ color: "var(--coral-300)" }}>Start heading out.</span>
            </h2>
            <p>
              Log in to access your curated venues, saved group itineraries, and real-time weather-reactive date plans.
            </p>
          </div>

          {/* Floating mini preview card */}
          <div className="auth-panel-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="tag" style={{ background: "var(--cat-nightlife-bg)", color: "var(--cat-nightlife)" }}>
                <Icons.Nightlife size={12} style={{ marginRight: 4 }} /> Craft Brewery Night
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--amber-400)", fontWeight: 700 }}>
                95% match
              </span>
            </div>
            <strong style={{ fontSize: "1rem", display: "block", color: "#fff" }}>Toit Brewpub · Indiranagar</strong>
            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.75)", margin: "4px 0 0" }}>
              Table for 4 reserved · Low rain probability tonight
            </p>
          </div>

          <div className="auth-panel-quote">
            &ldquo;Nearby &amp; Co. turned our indecisive Friday evenings into a seamless two-minute plan.&rdquo;
            <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
              — Sneha K., Bengaluru Beta Tester
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="auth-form-panel">
        <div className="auth-form-container fade-up">
          <div className="auth-form-header">
            <Link href="/" className="logo auth-mobile-logo">
              <span className="logo-mark">N</span>
              Nearby &amp; Co.
            </Link>
            <h1>Welcome back</h1>
            <p className="lead">Log in to continue planning great outings.</p>
          </div>

          <form onSubmit={onSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email address</label>
              <div className="input-with-icon">
                <span className="input-icon"><Icons.Mail size={16} /></span>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label className="form-label" htmlFor="password">Password</label>
              </div>
              <div className="input-with-icon">
                <span className="input-icon"><Icons.Lock size={16} /></span>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your secure password"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Turnstile onToken={setCaptcha} resetSignal={captchaReset} />

            {error && (
              <div className="form-error fade-in" role="alert" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icons.AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" aria-label="Log in" className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? "Signing in…" : "Log in to workspace"}
            </button>
          </form>

          <div className="auth-footer">
            Don&apos;t have an account? <Link href="/signup">Create account for free</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
