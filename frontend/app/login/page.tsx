"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Login() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: Record<string, string> = {
        email: email.trim(),
        password,
      };

      if (isRegister) {
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
        setError(data.error || "Invalid email or password — check your credentials or create an account.");
        return;
      }

      router.push("/");
    } catch {
      setError("Authentication failed. Please check your network connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="top-row">
        <div>
          <p className="eyebrow">Nearby &amp; Co. · {isRegister ? "Create Account" : "User Login"}</p>
          <h1>{isRegister ? "Join Nearby & Co." : "Sign in to your account"}</h1>
          <p className="subtitle">
            {isRegister
              ? "Create a personal account to track outings, get recommendations, and save preferences."
              : "Enter your email and password to access your personalized recommendations and itineraries."}
          </p>
        </div>
        <Link href="/signup" className="btn-secondary" style={{ textDecoration: "none" }}>← Workspace setup</Link>
      </div>

      <form className="card fade-in" onSubmit={submit}>
        {isRegister && (
          <>
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Smith"
              required
            />
            <br />
          </>
        )}

        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. alex@example.com"
          required
        />
        <br />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <br />

        <button type="submit" className="btn-primary" disabled={loading || !email.trim() || !password}>
          {loading ? "Authenticating..." : isRegister ? "Create account" : "Log in"}
        </button>

        {error && <div className="error">{error}</div>}

        <p className="hint" style={{ marginTop: 14 }}>
          {isRegister ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                }}
                style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, textDecoration: "underline" }}
              >
                Log in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account yet?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                }}
                style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, textDecoration: "underline" }}
              >
                Sign up
              </button>
            </>
          )}
        </p>
      </form>
    </main>
  );
}
