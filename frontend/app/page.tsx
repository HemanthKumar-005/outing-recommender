"use client";

import { useState } from "react";
import Link from "next/link";

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_API_KEY || "demo-key";

const CATEGORIES = ["", "cafe", "restaurant", "bar", "museum", "park", "cinema", "shopping", "attraction"];
const OUTING_TYPES = ["friends", "couple", "family", "solo"];
const AGGREGATION_METHODS = [
  { value: "least_misery", label: "Least misery — nobody hates it" },
  { value: "average", label: "Average" },
  { value: "borda", label: "Borda — rank-based" },
];
const WEIGHT_KEYS = ["ml", "content", "collaborative", "context", "distance", "sentiment", "popularity"] as const;
const WEIGHT_LABELS: Record<string, string> = {
  ml: "ML score", content: "Content match", collaborative: "Similar guests",
  context: "Weather / time / budget fit", distance: "Distance", sentiment: "Reviews", popularity: "Popularity",
};

type ScoreBreakdown = Record<string, unknown>;

type Recommendation = {
  place: {
    id: number;
    name: string;
    category: string;
    price_range: number;
    distance_km: number;
    rating?: number;
  };
  score: number;
  score_breakdown: ScoreBreakdown;
  reasons: string[];
};

type RecommendResponse = {
  session_id: string;
  group_user_ids: number[] | null;
  group_aggregation: string | null;
  context: {
    time_of_day: string;
    day_of_week: string;
    weather: { condition: string; temp_c: number };
  };
  weight_profile: Record<string, string>;
  diversity: number;
  recommendations: Recommendation[];
};

export default function Home() {
  const [apiUrl] = useState(DEFAULT_API_URL);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [showKeyField, setShowKeyField] = useState(false);

  const [userId, setUserId] = useState("1");
  const [groupMode, setGroupMode] = useState(false);
  const [extraUserIds, setExtraUserIds] = useState("2, 3");
  const [aggregation, setAggregation] = useState("least_misery");
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");
  const [radiusKm, setRadiusKm] = useState("8");
  const [category, setCategory] = useState("");
  const [outingType, setOutingType] = useState("friends");
  const [diversity, setDiversity] = useState(0.15);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [weightOverrides, setWeightOverrides] = useState<Record<string, number> | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLng(pos.coords.longitude.toFixed(4));
      },
      () => setError("Could not get your location"),
    );
  }

  function updateWeight(key: string, value: number) {
    setWeightOverrides((prev) => ({ ...(prev || {}), [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setDismissed(new Set());
    try {
      const user_ids = groupMode
        ? [Number(userId), ...extraUserIds.split(",").map((s) => s.trim()).filter(Boolean).map(Number)]
        : undefined;

      const resp = await fetch(`${apiUrl}/recommendations/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({
          user_id: Number(userId),
          user_ids,
          group_aggregation: groupMode ? aggregation : undefined,
          lat: Number(lat),
          lng: Number(lng),
          radius_km: Number(radiusKm),
          category: category || undefined,
          outing_type: outingType,
          diversity,
          weight_overrides: weightOverrides || undefined,
          top_k: 10,
        }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${resp.status})`);
      }
      const data: RecommendResponse = await resp.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(placeId: number, action: "skip" | "like") {
    if (!result) return;
    if (action === "skip") {
      setDismissed((prev) => new Set(prev).add(placeId));
    }
    try {
      const resp = await fetch(
        `${apiUrl}/recommendations/recommendations/${result.session_id}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
          body: JSON.stringify({ place_id: placeId, action }),
        },
      );
      if (!resp.ok) return;
      const data = await resp.json();
      setResult({ ...result, recommendations: data.recommendations });
    } catch {
      // live re-rank is best-effort; the dismissal already hid the card
    }
  }

  const visibleRecs = result?.recommendations.filter((r) => !dismissed.has(r.place.id)) || [];

  return (
    <main className="page">
      <div className="top-row">
        <div>
          <p className="eyebrow">Nearby &amp; Co. · Outing Concierge</p>
          <h1>Where should we go tonight?</h1>
          <p className="subtitle">
            Ranked by fit, weather, budget and reviews — not just distance.
          </p>
        </div>
        <Link href="/model-card" className="btn-secondary" style={{ textDecoration: "none" }}>
          How does this rank?
        </Link>
      </div>

      <div style={{ marginTop: -18, marginBottom: 22 }}>
        <Link href="/signup" className="hint" style={{ color: "var(--slate)" }}>New here? Open a workspace →</Link>
      </div>

      <form className="card fade-in" onSubmit={submit}>
        <div className="grid">
          <div>
            <label>Guest ID</label>
            <input value={userId} onChange={(e) => setUserId(e.target.value)} required />
          </div>
          <div>
            <label>Outing type</label>
            <select value={outingType} onChange={(e) => setOutingType(e.target.value)}>
              {OUTING_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Latitude</label>
            <input value={lat} onChange={(e) => setLat(e.target.value)} required />
          </div>
          <div>
            <label>Longitude</label>
            <input value={lng} onChange={(e) => setLng(e.target.value)} required />
          </div>
          <div>
            <label>Radius (km)</label>
            <input value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} required />
          </div>
          <div>
            <label>Category (optional)</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c || "Any"}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="btn-secondary" onClick={useMyLocation}>Use my location</button>

        <div className="toggle-row">
          <label className="checkbox-label">
            <input type="checkbox" checked={groupMode} onChange={(e) => setGroupMode(e.target.checked)} />
            Planning for a group
          </label>
        </div>
        {groupMode && (
          <div className="grid">
            <div>
              <label>Other guest IDs</label>
              <input value={extraUserIds} onChange={(e) => setExtraUserIds(e.target.value)} placeholder="2, 3" />
            </div>
            <div>
              <label>Combine everyone's taste by</label>
              <select value={aggregation} onChange={(e) => setAggregation(e.target.value)}>
                {AGGREGATION_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="toggle-row">
          <button type="button" className="btn-secondary" onClick={() => setShowAdvanced((s) => !s)}>
            {showAdvanced ? "Hide" : "Show"} advanced controls
          </button>
          <button type="button" className="btn-secondary" style={{ marginLeft: 8 }} onClick={() => setShowKeyField((s) => !s)}>
            {showKeyField ? "Hide" : "Change"} workspace key
          </button>
        </div>
        {showKeyField && (
          <div>
            <label>Workspace API key</label>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <p className="hint">Every workspace's data is isolated at the database level — see the model card page.</p>
          </div>
        )}
        {showAdvanced && (
          <div className="advanced-panel">
            <label>Explore vs. exploit ({Math.round(diversity * 100)}% variety)</label>
            <input
              type="range" min={0} max={1} step={0.05} value={diversity}
              onChange={(e) => setDiversity(Number(e.target.value))}
            />
            <p className="hint">0% = safest top picks, 100% = maximize variety across categories and vibes.</p>

            <p className="hint" style={{ marginTop: 14 }}>Nudge how much each factor matters (optional):</p>
            {WEIGHT_KEYS.map((key) => (
              <div key={key} className="slider-row">
                <label>{WEIGHT_LABELS[key]}</label>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={weightOverrides?.[key] ?? ""}
                  onChange={(e) => updateWeight(key, Number(e.target.value))}
                />
              </div>
            ))}
            {weightOverrides && (
              <button type="button" className="btn-secondary" onClick={() => setWeightOverrides(null)}>
                Reset to defaults
              </button>
            )}
          </div>
        )}

        <br />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Setting the table..." : "Get recommendations"}
        </button>
        {error && <div className="error">{error}</div>}
      </form>

      {result && (
        <div className="results-card fade-in">
          <div className="context-line">
            {result.context.time_of_day} · {result.context.day_of_week} ·{" "}
            {result.context.weather?.condition}, {result.context.weather?.temp_c}°C
            {result.group_user_ids && ` · party of ${result.group_user_ids.length} (${result.group_aggregation})`}
          </div>
          {visibleRecs.length === 0 && <p className="empty">No places left to show. Try a larger radius or fewer skips.</p>}
          {visibleRecs.map((rec) => (
            <div className="ticket" key={rec.place.id}>
              <div className="ticket-stub">
                <span className="ticket-score">{Math.round(rec.score * 100)}</span>
                <span className="ticket-score-label">match</span>
                <span className="ticket-category">{rec.place.category}</span>
              </div>
              <div className="ticket-main">
                <div className="ticket-header">
                  <span className="ticket-name">{rec.place.name}</span>
                </div>
                <div className="ticket-meta">
                  {"$".repeat(rec.place.price_range)} · {rec.place.distance_km} km away
                  {rec.place.rating ? ` · ${rec.place.rating}/5` : ""}
                </div>
                <div className="reasons">
                  {rec.reasons.map((r, i) => (
                    <span className="reason-chip" key={i}>{r}</span>
                  ))}
                </div>
                <div className="action-row">
                  <button type="button" className="btn-tiny" onClick={() => sendFeedback(rec.place.id, "like")}>
                    More like this
                  </button>
                  <button type="button" className="btn-tiny" onClick={() => sendFeedback(rec.place.id, "skip")}>
                    Skip
                  </button>
                  <button
                    type="button" className="btn-tiny"
                    onClick={() => setExpandedId(expandedId === rec.place.id ? null : rec.place.id)}
                  >
                    {expandedId === rec.place.id ? "Hide details" : "Why this?"}
                  </button>
                </div>
                {expandedId === rec.place.id && (
                  <pre className="breakdown">{JSON.stringify(rec.score_breakdown, null, 2)}</pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
