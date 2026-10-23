"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyEmailToken } from "../../lib/api";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setState("error");
      setMessage("This link is missing its token.");
      return;
    }
    verifyEmailToken(token)
      .then(() => {
        setState("ok");
        setTimeout(() => router.push("/onboarding"), 1200);
      })
      .catch((e) => {
        setState("error");
        setMessage(e instanceof Error ? e.message : "Verification failed.");
      });
  }, [params, router]);

  return (
    <div className="auth-page">
      <div className="auth-card fade-up">
        {state === "working" && <p>Confirming your email…</p>}
        {state === "ok" && (<><h1>Email confirmed</h1><p className="lead">Taking you to set up your preferences…</p></>)}
        {state === "error" && (
          <>
            <h1>We couldn&apos;t confirm that link</h1>
            <p className="lead">{message}</p>
            <p><Link href="/login">Back to log in</Link></p>
          </>
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
