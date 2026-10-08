"use client";

import { useState } from "react";
import { getSurprisePlace } from "../../lib/api";
import PlaceImage from "../PlaceImage";

const MOOD_KEYWORDS = [
  { label: "Brewery", emoji: "🍻", query: "brewery" },
  { label: "Café", emoji: "☕", query: "cafe" },
  { label: "Park & Nature", emoji: "🌳", query: "park" },
  { label: "Beach / Lake", emoji: "🏖️", query: "beach" },
  { label: "Heritage / Fort", emoji: "🏰", query: "fort" },
  { label: "Fine Dining", emoji: "🍽️", query: "restaurant" },
  { label: "Shopping", emoji: "🛍️", query: "shopping" },
  { label: "Scenic View", emoji: "🌄", query: "viewpoint" },
  { label: "Culture", emoji: "🛕", query: "temple" },
];

export type SurprisePlace = {
  id?: number | string;
  name?: string;
  category?: string;
  subcategory?: string;
  city?: string;
  state?: string;
  rating?: number;
  price_range?: number;
  description?: string;
  note?: string;
  [key: string]: unknown;
};

type Props = {
  occasion?: string;
  lat?: number;
  lng?: number;
  city?: string;
  onSelect?: (place: SurprisePlace) => void;
};

export default function SurpriseButton({ occasion, lat, lng, city, onSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [place, setPlace] = useState<SurprisePlace | null>(null);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState("");
  const [activeMode, setActiveMode] = useState<"anywhere" | "city" | "keyword">("city");

  const runSurprise = async (mode: "anywhere" | "city" | "keyword", customKw?: string) => {
    setLoading(true);
    setError("");
    setActiveMode(mode);
    try {
      const kw = customKw !== undefined ? customKw : keyword;
      const params: Parameters<typeof getSurprisePlace>[0] = {
        keyword: kw.trim() || undefined,
        occasion: occasion || undefined,
      };

      if (mode === "city" && lat && lng) {
        params.lat = lat;
        params.lng = lng;
        params.radius_km = 35;
      }

      const data = await getSurprisePlace(params);
      setPlace(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not find a surprise spot. Try another keyword or city.");
      setPlace(null);
    } finally {
      setLoading(false);
    }
  };

  const openInGoogleMaps = (p: Record<string, unknown>) => {
    const name = String(p.name || "");
    const placeCity = String(p.city || city || "");
    const q = encodeURIComponent(`${name} ${placeCity}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="card fade-in" style={{ marginBottom: 24, border: "1px solid var(--hairline)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8, fontSize: "1.3rem" }}>
            <span>🎲</span> Surprise Date Spot Generator
          </h3>
          <p className="hint" style={{ margin: 0 }}>
            {city
              ? `Serendipitous picks in ${city} or anywhere in Karnataka & India.`
              : "Discover curated romantic hideaways, craft breweries, viewpoints, and cozy cafes."}
          </p>
        </div>
      </div>

      {/* Quick Action Mode Buttons */}
      <div style={{ display: "grid", gridTemplateColumns: city && lat && lng ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 16 }}>
        {city && lat && lng && (
          <button
            type="button"
            className={`btn ${activeMode === "city" ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "10px 16px" }}
            onClick={() => runSurprise("city")}
            disabled={loading}
          >
            🏙️ Surprise in {city}
          </button>
        )}
        <button
          type="button"
          className={`btn ${activeMode === "anywhere" && (!city || !lat || !lng) ? "btn-primary" : "btn-secondary"}`}
          style={{ padding: "10px 16px" }}
          onClick={() => runSurprise("anywhere")}
          disabled={loading}
        >
          🎯 Surprise Anywhere in India
        </button>
      </div>

      {/* Keyword / Vibe Search */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="form-input"
            style={{ flex: 1 }}
            placeholder="Type a vibe (e.g. beach, brewery, rooftop, quiet cafe, garden)…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSurprise("keyword");
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: "10px 20px" }}
            onClick={() => runSurprise("keyword")}
            disabled={loading}
          >
            {loading ? "Searching…" : "Surprise Me"}
          </button>
        </div>
      </div>

      {/* Mood Quick Chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {MOOD_KEYWORDS.map((m) => (
          <button
            key={m.label}
            type="button"
            className={`chip ${keyword === m.query ? "active" : ""}`}
            style={{ fontSize: "0.82rem", padding: "6px 12px" }}
            onClick={() => {
              setKeyword(m.query);
              runSurprise("keyword", m.query);
            }}
          >
            <span>{m.emoji}</span> {m.label}
          </button>
        ))}
      </div>

      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: "center", padding: "28px 16px", background: "var(--ink-3)", borderRadius: "var(--radius)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }} className="animate-float">✨</div>
          <p style={{ margin: 0, fontWeight: 600, color: "var(--slate-strong)" }}>Finding the perfect surprise date spot…</p>
        </div>
      )}

      {/* Result Card */}
      {place && !loading && (
        <div
          className="fade-up"
          style={{
            marginTop: 18,
            borderRadius: "var(--radius)",
            overflow: "hidden",
            border: "2px solid var(--brass)",
            background: "var(--ink-2)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
          }}
        >
          {/* Header strip */}
          <div
            style={{
              padding: "10px 16px",
              background: "linear-gradient(135deg, var(--brass), #C45C6A)",
              color: "#fff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "0.92rem", display: "flex", alignItems: "center", gap: 6 }}>
              <span>🎉</span> Surprise Date Spot!
            </span>
            {place.note ? (
              <span style={{ fontSize: "0.78rem", opacity: 0.95, fontWeight: 500 }}>
                {place.note}
              </span>
            ) : null}
          </div>

          {/* Place image */}
          <div style={{ width: "100%", height: 160, position: "relative", overflow: "hidden", background: "#f0ece6" }}>
            <PlaceImage
              placeName={String(place.name || "")}
              category={String(place.category || "")}
              city={String(place.city || city || "")}
            />
          </div>

          {/* Place details */}
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
              <div>
                <h4 style={{ margin: "0 0 4px", fontSize: "1.35rem", fontWeight: 700, color: "var(--slate-strong)" }}>
                  {String(place.name)}
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: "0.86rem", color: "var(--slate)" }}>
                  <span style={{ fontWeight: 600, color: "var(--brass-bright)", textTransform: "capitalize" }}>
                    📍 {String(place.city || city || "Karnataka")}
                    {place.state ? `, ${String(place.state)}` : ""}
                  </span>
                  {place.rating != null && (
                    <span style={{ fontWeight: 600, color: "#fbbf24" }}>★ {Number(place.rating).toFixed(1)}/5</span>
                  )}
                  {place.price_range != null && (
                    <span style={{ fontWeight: 600 }}>{"₹".repeat(Number(place.price_range))}</span>
                  )}
                </div>
              </div>
              <span
                style={{
                  background: "rgba(224, 122, 95, 0.2)",
                  color: "var(--brass-bright)",
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {String(place.category || "spot")}
              </span>
            </div>

            {place.description && (
              <p style={{ margin: "10px 0 16px", color: "var(--slate)", fontSize: "0.92rem", lineHeight: 1.55 }}>
                {String(place.description)}
              </p>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, minWidth: 160 }}
                onClick={() => openInGoogleMaps(place)}
              >
                📍 View on Google Maps ↗
              </button>

              {onSelect && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, minWidth: 160 }}
                  onClick={() => onSelect(place)}
                >
                  💖 Use in Date Plan
                </button>
              )}

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => runSurprise(activeMode)}
                title="Roll another surprise"
              >
                🔄 Try Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
