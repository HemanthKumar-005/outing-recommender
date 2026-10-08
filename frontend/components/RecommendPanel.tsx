"use client";
import LocationPicker, { type LocationSelection } from "./LocationPicker";

type RecommendPanelProps = {
  location?: LocationSelection | null;
  onLocationChange?: (loc: LocationSelection) => void;
  hideLocationPicker?: boolean;
};

import { useState } from "react";
import { apiFetch, type RecommendResponse, type Recommendation } from "../lib/api";
import RecommendationCard from "./RecommendationCard";

const CATEGORIES = ["", "cafe", "restaurant", "bar", "museum", "park", "cinema", "shopping", "attraction"];
const OUTING_TYPES = ["friends", "couple", "family", "solo"];

export default function RecommendPanel({ location: controlledLocation, onLocationChange, hideLocationPicker }: RecommendPanelProps = {} as RecommendPanelProps) {
  const [userId, setUserId] = useState("1");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusKm, setRadiusKm] = useState("25");
  const [category, setCategory] = useState("");
  const [occasion, setOccasion] = useState("");
  const [internalLocation, setInternalLocation] = useState<LocationSelection | null>(null);
  const location = controlledLocation !== undefined ? controlledLocation : internalLocation;
  const setLocation = (loc: LocationSelection) => {
    if (onLocationChange) onLocationChange(loc);
    if (controlledLocation === undefined) setInternalLocation(loc);
  };
  const [outingType, setOutingType] = useState("friends");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const recommend = async () => {
    if (!location && (!lat || !lng)) {
      setError("Pick a city (anywhere in India) or enter coordinates.");
      return;
    }
    setLoading(true);
    setError(null);
    setSkipped(new Set());
    try {
      const body = {
        user_id: parseInt(userId, 10) || 1,
        lat: location?.lat ?? parseFloat(lat),
        lng: location?.lng ?? parseFloat(lng),
        city: location?.city,
        state: location?.state,
        radius_km: parseFloat(radiusKm) || 25,
        category: category || undefined,
        outing_type: outingType,
        occasion: occasion || undefined,
        limit: 8,
      };
      const res = await apiFetch("recommendations/recommendations", {
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
        <div style={{ marginBottom: 16 }}>
          {!hideLocationPicker && (
          <LocationPicker value={location} onChange={setLocation} />
        )}
        </div>
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
            <label className="form-label">Occasion</label>
            <select className="form-select" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
              <option value="">Any</option>
              <option value="first_date">First Date</option>
              <option value="romantic">Romantic</option>
              <option value="anniversary">Anniversary</option>
              <option value="brewery_tour">Brewery Tour</option>
              <option value="adventure">Adventure</option>
              <option value="cultural">Cultural</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          {!location && (
            <>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Latitude (optional)</label>
            <input className="form-input" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="or pick a city above" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Longitude (optional)</label>
            <input className="form-input" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="or pick a city above" />
          </div>
            </>
          )}
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
              city={location?.city}
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
