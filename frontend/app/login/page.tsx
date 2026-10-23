"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginUser, isOnboarded } from "../../lib/api";
import Turnstile from "../../components/Turnstile";

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
    <div className="auth-page">
      <div className="auth-card fade-up">
        <Link href="/login" className="logo" style={{ marginBottom: 28, display: "inline-flex" }}>
          <span className="logo-mark">N</span>
          Nearby &amp; Co.
        </Link>
        <h1>Welcome back</h1>
        <p className="lead">Log in to continue planning great outings.</p>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
            />
          </div>
          <Turnstile onToken={setCaptcha} resetSignal={captchaReset} />
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? "Signing in…" : "Log in"}
          </button>
        </form>
        <div className="auth-footer">
          New here? <Link href="/signup">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
