"use client";

import { useState, useMemo } from "react";
import RecommendationCard from "./RecommendationCard";
import { DEMO_PLACES } from "../lib/demo-data";

const OUTING = ["Solo", "Couple", "Friends", "Family"];
const BUDGET = ["Low", "Medium", "High"];
const CATEGORY = ["Any", "Café", "Restaurant", "Cinema", "Park", "Museum", "Bar"];
const MOOD = ["Any", "Quiet", "Lively", "Romantic", "Adventure"];
const SETTING = ["Any", "Indoor", "Outdoor"];

export default function ProductDemo() {
  const [outing, setOuting] = useState("Friends");
  const [budget, setBudget] = useState("Medium");
  const [category, setCategory] = useState("Any");
  const [mood, setMood] = useState("Any");
  const [setting, setSetting] = useState("Any");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [whyId, setWhyId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const results = useMemo(() => {
    if (!searched) return [];
    let list = [...DEMO_PLACES];
    if (category !== "Any") {
      const map: Record<string, string> = {
        Café: "cafe", Restaurant: "restaurant", Cinema: "cinema",
        Park: "park", Museum: "museum", Bar: "bar",
      };
      const cat = map[category];
      if (cat) list = list.filter((p) => p.category === cat).concat(list.filter((p) => p.category !== cat));
    }
    if (setting === "Indoor") list = list.filter((p) => p.indoor);
    if (setting === "Outdoor") list = list.filter((p) => !p.indoor);
    if (budget === "Low") list = list.filter((p) => p.price_range <= 2);
    if (budget === "High") list = list.sort((a, b) => b.rating - a.rating);
    return list.filter((p) => !skipped.has(p.id)).slice(0, 4);
  }, [searched, category, setting, budget, skipped]);

  const find = () => {
    setLoading(true);
    setSkipped(new Set());
    setTimeout(() => {
      setSearched(true);
      setLoading(false);
    }, 700);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <div className="demo-panel">
      <div className="demo-filters">
        <div>
          <div className="form-label">Who&apos;s going?</div>
          <div className="chip-group">
            {OUTING.map((o) => (
              <button key={o} type="button" className={`chip ${outing === o ? "active" : ""}`} onClick={() => setOuting(o)}>
                {o}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="form-label">Budget</div>
          <div className="chip-group">
            {BUDGET.map((b) => (
              <button key={b} type="button" className={`chip ${budget === b ? "active" : ""}`} onClick={() => setBudget(b)}>
                {b}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="form-label">Category</div>
          <div className="chip-group">
            {CATEGORY.map((c) => (
              <button key={c} type="button" className={`chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="form-label">Mood · Setting</div>
          <div className="chip-group">
            {MOOD.map((m) => (
              <button key={m} type="button" className={`chip ${mood === m ? "active" : ""}`} onClick={() => setMood(m)}>
                {m}
              </button>
            ))}
            {SETTING.map((s) => (
              <button key={s} type="button" className={`chip ${setting === s ? "active" : ""}`} onClick={() => setSetting(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={find} disabled={loading}>
          {loading ? "Finding…" : "Find My Outing"}
        </button>
      </div>

      <div className="demo-results">
        {!searched && !loading && (
          <p className="empty" style={{ padding: "24px 0" }}>
            Choose your preferences above, then hit Find My Outing.
          </p>
        )}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 100 }} />
            ))}
          </div>
        )}
        {searched && !loading && results.length === 0 && (
          <p className="empty">No places left — try different filters or clear skips.</p>
        )}
        {searched &&
          !loading &&
          results.map((p) => (
            <RecommendationCard
              key={p.id}
              name={p.name}
              category={p.category}
              match={p.match}
              rating={p.rating}
              distance_km={p.distance_km}
              price_range={p.price_range}
              reason={p.reason}
              weather_fit={p.weather_fit}
              liked={liked.has(p.id)}
              showWhy={whyId === p.id}
              whyContent={`Match ${p.match}% · ${p.ambience} · ${p.weather_fit}\nAligned with ${outing} · ${budget} budget · ${mood} mood`}
              onLike={() => {
                setLiked((s) => new Set(s).add(p.id));
                showToast(`Liked ${p.name}`);
              }}
              onSkip={() => {
                setSkipped((s) => new Set(s).add(p.id));
                showToast("Skipped");
              }}
              onAdd={() => showToast(`Added ${p.name} to itinerary`)}
              onWhy={() => setWhyId(whyId === p.id ? null : p.id)}
            />
          ))}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
