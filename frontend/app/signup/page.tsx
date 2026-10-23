"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signupUser, loginUser } from "../../lib/api";
import Turnstile from "../../components/Turnstile";

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
      setError("Use a password with at least 10 characters.");
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
        setCheckEmail(true); // same message whether or not the address was already registered
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
    <div className="auth-page">
      <div className="auth-card fade-up">
        <Link href="/" className="logo" style={{ marginBottom: 28, display: "inline-flex" }}>
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
            <p className="lead">Free during the beta. This is an early-access product: some venue details are estimates.</p>
            <form onSubmit={onSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="name">Your name</label>
                <input id="name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <input id="email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input id="password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} maxLength={128} autoComplete="new-password" />
                <p className="form-hint">At least 10 characters.</p>
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <input id="terms" type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} style={{ marginTop: 4 }} />
                <label htmlFor="terms" style={{ fontSize: "0.88rem", color: "var(--slate)" }}>
                  I agree to the <Link href="/terms" target="_blank">Terms of Service</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.
                </label>
              </div>
              <Turnstile onToken={setCaptcha} resetSignal={captchaReset} />
              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>
          </>
        )}
        <div className="auth-footer">
          Already have an account? <Link href="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
