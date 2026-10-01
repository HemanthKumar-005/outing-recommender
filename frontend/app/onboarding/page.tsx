"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "../../lib/api";

const CATEGORIES = [
  { id: "cafe", label: "☕ Cafés" },
  { id: "restaurant", label: "🍽️ Restaurants" },
  { id: "cinema", label: "🎬 Movies" },
  { id: "park", label: "🌳 Parks" },
  { id: "museum", label: "🎨 Museums" },
  { id: "shopping", label: "🛍️ Shopping" },
  { id: "bar", label: "🎵 Entertainment" },
];

const EXPERIENCES = ["Solo", "Couple", "Friends", "Family"];
const PRIORITIES = ["Budget", "Distance", "Rating", "Ambience", "Weather", "Popularity"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [exp, setExp] = useState<Set<string>>(new Set());
  const [pri, setPri] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated()) router.replace("/signup");
  }, [router]);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const finish = () => {
    localStorage.setItem(
      "nearby_preferences",
      JSON.stringify({
        categories: Array.from(cats),
        experiences: Array.from(exp),
        priorities: Array.from(pri),
      })
    );
    localStorage.setItem("nearby_onboarded", "true");
    router.push("/dashboard");
  };

  const steps = [
    {
      title: "What kind of outings do you enjoy?",
      body: (
        <div className="onboard-options">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={`chip ${cats.has(c.id) ? "active" : ""}`} onClick={() => toggle(cats, c.id, setCats)}>
              {c.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "What kind of experiences do you usually plan?",
      body: (
        <div className="onboard-options">
          {EXPERIENCES.map((e) => (
            <button key={e} type="button" className={`chip ${exp.has(e) ? "active" : ""}`} onClick={() => toggle(exp, e, setExp)}>
              {e}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "What matters most?",
      body: (
        <div className="onboard-options">
          {PRIORITIES.map((p) => (
            <button key={p} type="button" className={`chip ${pri.has(p) ? "active" : ""}`} onClick={() => toggle(pri, p, setPri)}>
              {p}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "Your recommendations are ready.",
      body: (
        <p className="lead" style={{ margin: "24px auto" }}>
          We&apos;ll use your preferences to rank places for your workspace. You can refine anytime from Settings.
        </p>
      ),
    },
  ];

  const current = steps[step];

  return (
    <div className="auth-page">
      <div className="onboard-step fade-up" style={{ width: "100%" }}>
        <div className="onboard-progress">
          {steps.map((_, i) => (
            <div key={i} className={`onboard-dot ${i === step ? "active" : ""} ${i < step ? "done" : ""}`} />
          ))}
        </div>
        <h1 style={{ fontSize: "1.8rem", marginBottom: 8 }}>{current.title}</h1>
        {current.body}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32 }}>
          {step > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>Back</button>
          )}
          {step < steps.length - 1 ? (
            <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>Continue</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={finish}>Go to dashboard</button>
          )}
        </div>
      </div>
    </div>
  );
}
