"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, fetchMe } from "../../lib/api";
import { Icons } from "../../components/Icons";

type CategoryItem = {
  id: string;
  label: string;
  desc: string;
  icon: string;
  catColor: string;
  catBg: string;
  catBorder: string;
};

const CATEGORIES: CategoryItem[] = [
  {
    id: "cafe",
    label: "Cozy Cafés",
    desc: "Quiet corners, specialty espresso & slow mornings",
    icon: "☕",
    catColor: "var(--coral-400)",
    catBg: "var(--cat-food-bg)",
    catBorder: "var(--cat-food-border)",
  },
  {
    id: "restaurant",
    label: "Dining & Bistros",
    desc: "Sit-down dinners, rooftop terraces & shared plates",
    icon: "🍽️",
    catColor: "var(--coral-500)",
    catBg: "var(--cat-food-bg)",
    catBorder: "var(--cat-food-border)",
  },
  {
    id: "park",
    label: "Parks & Greenery",
    desc: "Lakefront walks, botanical gardens & open lawns",
    icon: "🌳",
    catColor: "var(--teal-400)",
    catBg: "var(--cat-outdoors-bg)",
    catBorder: "var(--cat-outdoors-border)",
  },
  {
    id: "bar",
    label: "Bars & Breweries",
    desc: "Craft beer flights, speakeasies & late evening drinks",
    icon: "🍸",
    catColor: "var(--violet-400)",
    catBg: "var(--cat-nightlife-bg)",
    catBorder: "var(--cat-nightlife-border)",
  },
  {
    id: "museum",
    label: "Museums & Arts",
    desc: "Modern art, interactive exhibitions & heritage halls",
    icon: "🎨",
    catColor: "var(--cat-culture)",
    catBg: "var(--cat-culture-bg)",
    catBorder: "var(--cat-culture-border)",
  },
  {
    id: "cinema",
    label: "Cinema & Screens",
    desc: "Indie screening rooms, IMAX theatres & film festivals",
    icon: "🎬",
    catColor: "var(--amber-400)",
    catBg: "rgba(245, 158, 11, 0.12)",
    catBorder: "rgba(245, 158, 11, 0.35)",
  },
  {
    id: "shopping",
    label: "Boutiques & Malls",
    desc: "Curated bookstores, artisan markets & shopping plazas",
    icon: "🛍️",
    catColor: "var(--cat-activity)",
    catBg: "var(--cat-activity-bg)",
    catBorder: "var(--cat-activity-border)",
  },
];

const EXPERIENCES = [
  { id: "Solo", label: "Solo Outings", desc: "Thoughtful spots with low decibels and comfortable single seating", icon: "👤", color: "var(--teal-400)" },
  { id: "Couple", label: "Date Nights", desc: "Intimate lighting, ambient music, and memorable table settings", icon: "♥", color: "var(--rose-400)" },
  { id: "Friends", label: "Friends & Groups", desc: "Spacious tables, shareable food, craft drinks & vibrant energy", icon: "👥", color: "var(--coral-400)" },
  { id: "Family", label: "Family Gatherings", desc: "Easy parking, kid-friendly menus, comfortable all-age layouts", icon: "🏡", color: "var(--amber-400)" },
];

const OCCASIONS = [
  { id: "first_date", label: "First Date", desc: "Low-pressure conversation with easy exit options", icon: "✨" },
  { id: "romantic", label: "Romantic Evening", desc: "Candlelight, scenic city views & cozy ambiance", icon: "🌹" },
  { id: "anniversary", label: "Anniversary Celebration", desc: "High-touch dining, cocktails & memorable setting", icon: "🥂" },
  { id: "brewery_tour", label: "Craft Brewery Tour", desc: "Flight tastings, hops education & relaxed patios", icon: "🍻" },
  { id: "adventure", label: "Weekend Adventure", desc: "Active trails, viewpoints & outdoor exploration", icon: "🧗" },
  { id: "cultural", label: "Art & Heritage Walk", desc: "Historic landmarks, galleries & architectural gems", icon: "🏛️" },
  { id: "casual", label: "Casual Catchup", desc: "Spontaneous coffee, quick bites, zero reservation stress", icon: "☕" },
];

const PRIORITIES = [
  { id: "Budget", label: "Budget-Friendly", desc: "Keep outings within reasonable per-person limits", icon: "💰" },
  { id: "Distance", label: "Nearby Proximity", desc: "Prioritize short commutes and walkable venues", icon: "📍" },
  { id: "Rating", label: "Top Rated Only", desc: "Filter strictly for highly reviewed local favorites", icon: "★" },
  { id: "Ambience", label: "Atmosphere & Vibe", desc: "Cozy acoustics, warm interior lighting and decor", icon: "🕯️" },
  { id: "Weather", label: "Weather Safety", desc: "Automatic rainy day fallback and covered routes", icon: "⛅" },
  { id: "Popularity", label: "Buzz & Popularity", desc: "Trendiest spots with vibrant crowds and energy", icon: "🔥" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [cats, setCats] = useState<Set<string>>(new Set(["cafe", "restaurant", "park"]));
  const [exp, setExp] = useState<Set<string>>(new Set(["Couple", "Friends"]));
  const [pri, setPri] = useState<Set<string>>(new Set(["Ambience", "Weather"]));
  const [occ, setOcc] = useState<Set<string>>(new Set(["romantic", "casual"]));

  useEffect(() => {
    fetchMe().then((u) => {
      if (!u) router.replace("/signup");
    });
  }, [router]);

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const finish = async () => {
    try {
      await apiFetch("users/users/me/preferences", {
        method: "PUT",
        body: JSON.stringify({
          preferred_categories: Array.from(cats),
          preferred_occasions: Array.from(occ),
          ambience_preferences: [...Array.from(exp), ...Array.from(pri)],
        }),
      });
    } catch {
      /* non-fatal fallback */
    }
    localStorage.setItem(
      "nearby_preferences",
      JSON.stringify({
        categories: Array.from(cats),
        experiences: Array.from(exp),
        priorities: Array.from(pri),
        occasions: Array.from(occ),
      })
    );
    localStorage.setItem("nearby_onboarded", "true");
    router.push("/dashboard");
  };

  const totalSteps = 5;
  const progressPercent = ((step + 1) / totalSteps) * 100;

  return (
    <div className="onboard-shell">
      {/* Top Header & Step Progress Bar */}
      <header className="onboard-header">
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" className="logo">
            <span className="logo-mark">N</span>
            Nearby &amp; Co.
          </Link>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Step <strong style={{ color: "var(--coral-400)" }}>{step + 1}</strong> of {totalSteps}
          </div>
        </div>

        {/* Linear progress bar */}
        <div className="onboard-progress-track">
          <div
            className="onboard-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <main className="container" style={{ maxWidth: 840, padding: "40px 20px 80px" }}>
        {/* Step 0: Outing Categories */}
        {step === 0 && (
          <div className="fade-up">
            <div className="section-header center" style={{ marginBottom: 28 }}>
              <span className="eyebrow">Personal Taste Profile</span>
              <h1 style={{ fontSize: "2rem", margin: "4px 0 8px" }}>What kind of outings do you enjoy?</h1>
              <p className="lead" style={{ maxWidth: 520, margin: "0 auto" }}>
                Select all that apply. Our hybrid ranker will weight these categories in your initial candidate pools.
              </p>
            </div>

            <div className="onboard-tiles-grid">
              {CATEGORIES.map((c) => {
                const isSelected = cats.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`onboard-tile ${isSelected ? "selected" : ""}`}
                    onClick={() => toggle(cats, c.id, setCats)}
                    style={{
                      borderColor: isSelected ? c.catColor : undefined,
                      background: isSelected ? c.catBg : undefined,
                    }}
                  >
                    <div className="onboard-tile-icon" style={{ borderColor: c.catBorder }}>
                      {c.icon}
                    </div>
                    <div className="onboard-tile-content">
                      <div className="onboard-tile-title">{c.label}</div>
                      <div className="onboard-tile-desc">{c.desc}</div>
                    </div>
                    <div className="onboard-tile-check" style={{ borderColor: isSelected ? c.catColor : undefined, background: isSelected ? c.catColor : undefined }}>
                      {isSelected ? <Icons.Check size={12} style={{ color: "#fff" }} /> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ textAlign: "center", marginTop: 12, fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {cats.size} categories selected
            </div>
          </div>
        )}

        {/* Step 1: Planning Style / Companions */}
        {step === 1 && (
          <div className="fade-up">
            <div className="section-header center" style={{ marginBottom: 28 }}>
              <span className="eyebrow">Outing Companions</span>
              <h1 style={{ fontSize: "2rem", margin: "4px 0 8px" }}>Who are you usually planning for?</h1>
              <p className="lead" style={{ maxWidth: 520, margin: "0 auto" }}>
                We adjust space requirements, noise levels, and group consensus algorithms accordingly.
              </p>
            </div>

            <div className="onboard-tiles-grid">
              {EXPERIENCES.map((e) => {
                const isSelected = exp.has(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    className={`onboard-tile ${isSelected ? "selected" : ""}`}
                    onClick={() => toggle(exp, e.id, setExp)}
                    style={{
                      borderColor: isSelected ? e.color : undefined,
                    }}
                  >
                    <div className="onboard-tile-icon" style={{ fontSize: "1.3rem" }}>
                      {e.icon}
                    </div>
                    <div className="onboard-tile-content">
                      <div className="onboard-tile-title">{e.label}</div>
                      <div className="onboard-tile-desc">{e.desc}</div>
                    </div>
                    <div className="onboard-tile-check" style={{ borderColor: isSelected ? e.color : undefined, background: isSelected ? e.color : undefined }}>
                      {isSelected ? <Icons.Check size={12} style={{ color: "#fff" }} /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Occasions */}
        {step === 2 && (
          <div className="fade-up">
            <div className="section-header center" style={{ marginBottom: 28 }}>
              <span className="eyebrow">Outing Occasions</span>
              <h1 style={{ fontSize: "2rem", margin: "4px 0 8px" }}>Special occasions you often plan?</h1>
              <p className="lead" style={{ maxWidth: 520, margin: "0 auto" }}>
                Helps our Date Planner match multi-stop itineraries to the right emotional tone.
              </p>
            </div>

            <div className="onboard-tiles-grid">
              {OCCASIONS.map((o) => {
                const isSelected = occ.has(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`onboard-tile ${isSelected ? "selected" : ""}`}
                    onClick={() => toggle(occ, o.id, setOcc)}
                  >
                    <div className="onboard-tile-icon">
                      {o.icon}
                    </div>
                    <div className="onboard-tile-content">
                      <div className="onboard-tile-title">{o.label}</div>
                      <div className="onboard-tile-desc">{o.desc}</div>
                    </div>
                    <div className="onboard-tile-check">
                      {isSelected ? <Icons.Check size={12} style={{ color: "#fff" }} /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Priorities */}
        {step === 3 && (
          <div className="fade-up">
            <div className="section-header center" style={{ marginBottom: 28 }}>
              <span className="eyebrow">Decision Criteria</span>
              <h1 style={{ fontSize: "2rem", margin: "4px 0 8px" }}>What matters most when choosing?</h1>
              <p className="lead" style={{ maxWidth: 520, margin: "0 auto" }}>
                Fine-tunes the initial scoring formula weights. You can always override these on any search.
              </p>
            </div>

            <div className="onboard-tiles-grid">
              {PRIORITIES.map((p) => {
                const isSelected = pri.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`onboard-tile ${isSelected ? "selected" : ""}`}
                    onClick={() => toggle(pri, p.id, setPri)}
                  >
                    <div className="onboard-tile-icon">
                      {p.icon}
                    </div>
                    <div className="onboard-tile-content">
                      <div className="onboard-tile-title">{p.label}</div>
                      <div className="onboard-tile-desc">{p.desc}</div>
                    </div>
                    <div className="onboard-tile-check">
                      {isSelected ? <Icons.Check size={12} style={{ color: "#fff" }} /> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4: Ready & Summary */}
        {step === 4 && (
          <div className="fade-up" style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--gradient-cta)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "var(--shadow-glow-coral)" }}>
              <Icons.Sparkles size={32} />
            </div>

            <span className="eyebrow" style={{ color: "var(--coral-400)" }}>Setup Complete</span>
            <h1 style={{ fontSize: "2.2rem", margin: "6px 0 12px" }}>Your recommendations are ready.</h1>
            <p className="lead" style={{ maxWidth: 520, margin: "0 auto 28px" }}>
              We&apos;ve calibrated your taste vector across <strong>{cats.size} categories</strong> and <strong>{pri.size} decision priorities</strong>.
              Your dashboard is personalized and ready to discover Indian venues.
            </p>

            <div className="card" style={{ maxWidth: 480, margin: "0 auto 32px", textAlign: "left", padding: "18px 22px" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Calibrated Preferences
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Array.from(cats).map((c) => (
                  <span key={c} className="tag" style={{ textTransform: "capitalize", background: "var(--cat-food-bg)", color: "var(--cat-food)" }}>
                    {c}
                  </span>
                ))}
                {Array.from(exp).map((e) => (
                  <span key={e} className="tag" style={{ background: "rgba(168,85,247,0.12)", color: "var(--violet-400)" }}>
                    {e}
                  </span>
                ))}
                {Array.from(pri).map((p) => (
                  <span key={p} className="tag" style={{ background: "rgba(20,184,166,0.12)", color: "var(--teal-400)" }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 36 }}>
          {step > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}

          {step < totalSteps - 1 ? (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => setStep(step + 1)}
              style={{ minWidth: 160 }}
            >
              Continue
              <Icons.ArrowRight size={16} style={{ marginLeft: 6 }} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={finish}
              style={{ minWidth: 200 }}
            >
              Open Dashboard
              <Icons.ArrowUpRight size={18} style={{ marginLeft: 6 }} />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
