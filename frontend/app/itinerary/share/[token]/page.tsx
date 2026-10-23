"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getApiUrl } from "../../../../lib/api";

type SharedPlan = {
  title?: string;
  description?: string;
  budget_estimate?: string;
  items: { name: string; category?: string; arrival?: string; departure?: string }[];
};

export default function SharedItineraryPage() {
  const { token } = useParams<{ token: string }>();
  const [plan, setPlan] = useState<SharedPlan | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${getApiUrl().replace(/\/$/, "")}/itinerary/shared/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPlan)
      .catch(() => setError(true));
  }, [token]);

  return (
    <main className="container" style={{ maxWidth: 720, padding: "48px 20px" }}>
      <p><Link href="/">Nearby &amp; Co.</Link></p>
      {error && <p>This shared plan was not found or is no longer shared.</p>}
      {!plan && !error && <p>Loading…</p>}
      {plan && (
        <>
          <h1>{plan.title || "Shared outing plan"}</h1>
          {plan.description && <p className="lead">{plan.description}</p>}
          {plan.budget_estimate && <p className="hint">Estimated budget: {plan.budget_estimate}</p>}
          <ol>
            {plan.items.map((it, i) => (
              <li key={i} style={{ margin: "12px 0" }}>
                <strong>{it.name}</strong>
                {it.arrival && <span className="hint"> · {new Date(it.arrival).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
              </li>
            ))}
          </ol>
          <p className="hint">Hours and prices may be estimates. Check with each venue before you go.</p>
        </>
      )}
    </main>
  );
}
