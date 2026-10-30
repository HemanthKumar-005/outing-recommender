"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signupUser, loginUser } from "../../lib/api";
import Turnstile from "../../components/Turnstile";
import { Icons } from "../../components/Icons";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError("Please use a password with at least 10 characters.");
      return;
    }
    if (!acceptTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      const res = await signupUser({ name: name.trim(), email: email.trim(), password, acceptTerms, captchaToken: captcha });
      if (res.verification_required) {
        setCheckEmail(true);
      } else {
        await loginUser({ email: email.trim(), password, captchaToken: captcha });
        router.push("/onboarding");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
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
              <Icons.Sparkles size={12} style={{ marginRight: 5 }} /> Free Early Access
            </span>
            <h2>
              Discover outings
              <br />
              <span className="hero-italic" style={{ color: "var(--coral-300)" }}>you&apos;ll actually love.</span>
            </h2>
            <p>
              Join the beta to get personalized recommendations tailored to your exact taste, group preferences, budget, and live weather.
            </p>
          </div>

          {/* Value Props Strip */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "24px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", fontSize: "0.92rem" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(20, 184, 166, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--teal-300)" }}>
                <Icons.Check size={14} />
              </div>
              <span>Curated catalog across top Indian cities</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", fontSize: "0.92rem" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(224, 94, 58, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--coral-300)" }}>
                <Icons.Check size={14} />
              </div>
              <span>Group consensus planner with multi-persona ranking</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", fontSize: "0.92rem" }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(168, 85, 247, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--violet-300)" }}>
                <Icons.Check size={14} />
              </div>
              <span>Automated rainy day and late-night fallback plans</span>
            </div>
          </div>

          <div className="auth-panel-quote">
            &ldquo;Zero tracking, zero sponsored clutter. Just places worth going to.&rdquo;
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
            {checkEmail ? (
              <div className="fade-in">
                <h1>Check your email</h1>
                <p className="lead">
                  If <strong>{email}</strong> can be registered, we&apos;ve sent a confirmation link. It expires in 24 hours.
                  Once confirmed, you can <Link href="/login">log in</Link>.
                </p>
              </div>
            ) : (
              <>
                <h1>Create your account</h1>
                <p className="lead">Free during early access beta. Venue details and hours are actively verified.</p>
              </>
            )}
          </div>

          {!checkEmail && (
            <form onSubmit={onSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label" htmlFor="name">Your name</label>
                <div className="input-with-icon">
                  <span className="input-icon"><Icons.User size={16} /></span>
                  <input
                    id="name"
                    className="form-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="First and last name"
                    required
                    maxLength={100}
                    autoComplete="name"
                  />
                </div>
              </div>

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
                <label className="form-label" htmlFor="password">Password</label>
                <div className="input-with-icon">
                  <span className="input-icon"><Icons.Lock size={16} /></span>
                  <input
                    id="password"
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 10 characters"
                    required
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </div>
                <p className="form-hint" style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                  Use at least 10 characters with a mix of letters and numbers.
                </p>
              </div>

              <div className="form-group" style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <input
                  id="terms"
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  style={{ marginTop: 4, width: 16, height: 16, accentColor: "var(--coral-500)", cursor: "pointer" }}
                />
                <label htmlFor="terms" style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5, cursor: "pointer" }}>
                  I agree to the <Link href="/terms" target="_blank" style={{ color: "var(--coral-400)", textDecoration: "underline" }}>Terms of Service</Link> and{" "}
                  <Link href="/privacy" target="_blank" style={{ color: "var(--coral-400)", textDecoration: "underline" }}>Privacy Policy</Link>.
                </label>
              </div>

              <Turnstile onToken={setCaptcha} resetSignal={captchaReset} />

              {error && (
                <div className="form-error fade-in" role="alert" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icons.AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" aria-label="Create account" className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: 8 }}>
                {loading ? "Creating your workspace…" : "Get Started Free ↗"}
              </button>
            </form>
          )}

          <div className="auth-footer">
            Already have an account? <Link href="/login">Log in here</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
