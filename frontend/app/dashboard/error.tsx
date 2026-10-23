"use client";

import { useEffect } from "react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Visible in the browser console and the host's logs; wire a free Sentry/GlitchTip browser SDK here later.
    console.error("dashboard error", error.digest || "", error.message);
  }, [error]);
  return (
    <div className="dash-content" role="alert">
      <h2>Something went wrong</h2>
      <p className="hint">We couldn&apos;t load this page. Your data is safe.</p>
      <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
