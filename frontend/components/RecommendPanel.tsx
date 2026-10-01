"use client";

import { useState } from "react";
import { apiFetch, type RecommendResponse, type Recommendation } from "../lib/api";
import RecommendationCard from "./RecommendationCard";

const CATEGORIES = ["", "cafe", "restaurant", "bar", "museum", "park", "cinema", "shopping", "attraction"];
const OUTING_TYPES = ["friends", "couple", "family", "solo"];

export default function RecommendPanel() {
  const [userId, setUserId] = useState("1");
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");
  const [radiusKm, setRadiusKm] = useState("8");
  const [category, setCategory] = useState("");
  const [outingType, setOutingType] = useState("friends");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const recommend = async () => {
    setLoading(true);
    setError(null);
    setSkipped(new Set());
    try {
      const body = {
        user_id: parseInt(userId, 10) || 1,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius_km: parseFloat(radiusKm) || 8,
        category: category || undefined,
        outing_type: outingType,
        limit: 8,
      };
      const res = await apiFetch("recommendations/recommend", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as RecommendResponse;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch recommendations");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async (placeId: number, type: "like" | "skip") => {
    try {
      await apiFetch("interactions/events", {
        method: "POST",
        body: JSON.stringify({
          user_id: parseInt(userId, 10) || 1,
          place_id: placeId,
          event_type: type === "like" ? "save" : "skip",
        }),
      });
    } catch {
      /* feedback best-effort */
    }
    if (type === "skip") setSkipped((s) => new Set(s).add(placeId));
    setToast(type === "like" ? "Saved preference" : "Skipped");
    setTimeout(() => setToast(null), 2000);
  };

  const visible: Recommendation[] =
    result?.recommendations.filter((r) => !skipped.has(r.place.id)) || [];

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">User ID</label>
            <input className="form-input" value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Outing type</label>
            <select className="form-select" value={outingType} onChange={(e) => setOutingType(e.target.value)}>
              {OUTING_TYPES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Latitude</label>
            <input className="form-input" value={lat} onChange={(e) => setLat(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Longitude</label>
            <input className="form-input" value={lng} onChange={(e) => setLng(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Radius (km)</label>
            <input className="form-input" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Category</label>
            <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c || "any"} value={c}>{c || "Any"}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={recommend} disabled={loading}>
          {loading ? "Finding…" : "Get recommendations"}
        </button>
        {error && <p className="form-error">{error}</p>}
      </div>

      {result && (
        <div className="results-card fade-in">
          <div className="context-line">
            {result.context.time_of_day} · {result.context.day_of_week} ·{" "}
            {result.context.weather?.condition}, {result.context.weather?.temp_c}°C
            {result.group_user_ids && ` · party of ${result.group_user_ids.length}`}
          </div>
          {visible.length === 0 && <p className="empty">No places left. Try a larger radius or fewer skips.</p>}
          {visible.map((rec) => (
            <RecommendationCard
              key={rec.place.id}
              name={rec.place.name}
              category={rec.place.category}
              match={Math.round(rec.score * 100)}
              rating={rec.place.rating}
              distance_km={rec.place.distance_km}
              price_range={rec.place.price_range}
              reason={rec.reasons?.[0]}
              showWhy={expandedId === rec.place.id}
              whyContent={JSON.stringify(rec.score_breakdown, null, 2)}
              onLike={() => sendFeedback(rec.place.id, "like")}
              onSkip={() => sendFeedback(rec.place.id, "skip")}
              onWhy={() => setExpandedId(expandedId === rec.place.id ? null : rec.place.id)}
            />
          ))}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
