"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyEmailToken } from "../../lib/api";
import { Icons } from "../../components/Icons";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setState("error");
      setMessage("This link is missing its verification token.");
      return;
    }
    verifyEmailToken(token)
      .then(() => {
        setState("ok");
        setTimeout(() => router.push("/onboarding"), 1500);
      })
      .catch((e) => {
        setState("error");
        setMessage(e instanceof Error ? e.message : "Verification failed or token has expired.");
      });
  }, [params, router]);

  return (
    <div className="auth-page" style={{ background: "var(--bg-canvas)" }}>
      <div className="auth-card fade-up" style={{ textAlign: "center", maxWidth: 460 }}>
        <Link href="/" className="logo" style={{ marginBottom: 28, display: "inline-flex" }}>
          <span className="logo-mark">N</span>
          Nearby &amp; Co.
        </Link>

        {state === "working" && (
          <div className="fade-in">
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(224, 94, 58, 0.12)", color: "var(--coral-400)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Icons.RefreshCw size={26} className="animate-spin" />
            </div>
            <h2>Confirming your email…</h2>
            <p className="lead" style={{ color: "var(--text-muted)" }}>
              Please wait while we verify your secure registration token.
            </p>
          </div>
        )}

        {state === "ok" && (
          <div className="fade-in">
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(20, 184, 166, 0.15)", color: "var(--teal-400)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Icons.Check size={28} />
            </div>
            <h2>Email confirmed!</h2>
            <p className="lead" style={{ color: "var(--text-secondary)" }}>
              Your workspace is active. Redirecting you to set up your outing preferences…
            </p>
            <div className="skeleton-line" style={{ height: 4, width: "100%", borderRadius: 2, marginTop: 20 }} />
          </div>
        )}

        {state === "error" && (
          <div className="fade-in">
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(244, 63, 94, 0.15)", color: "var(--rose-400)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Icons.AlertCircle size={28} />
            </div>
            <h2>Verification link invalid</h2>
            <p className="lead" style={{ color: "var(--text-secondary)" }}>{message}</p>
            <Link href="/login" className="btn btn-primary btn-block" style={{ marginTop: 20 }}>
              Return to log in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
