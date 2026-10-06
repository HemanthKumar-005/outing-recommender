"use client";

import { useState } from "react";
import { getSurprisePlace } from "../../lib/api";

const KEYWORDS = ["beach", "brewery", "park", "temple", "shopping", "cafe", "mountain", "lake"];

type Props = {
  occasion?: string;
  lat?: number;
  lng?: number;
  onSelect?: (place: Record<string, unknown>) => void;
};

export default function SurpriseButton({ occasion, lat, lng, onSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [place, setPlace] = useState<Record<string, unknown> | null>(null);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState("");

  const run = async (kw?: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await getSurprisePlace({
        keyword: kw ?? (keyword || undefined),
        occasion: occasion || undefined,
        lat,
        lng,
        radius_km: 50,
      });
      setPlace(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Surprise failed");
      setPlace(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <h3 style={{ margin: 0, flex: 1 }}>🎲 Surprise Me</h3>
        <input
          className="form-input"
          style={{ maxWidth: 200 }}
          placeholder="keyword (optional)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <button type="button" className="btn btn-primary" onClick={() => run()} disabled={loading}>
          {loading ? "Finding…" : "Surprise"}
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {KEYWORDS.map((k) => (
          <button
            key={k}
            type="button"
            className="chip"
            onClick={() => {
              setKeyword(k);
              run(k);
            }}
          >
            {k}
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
      {place && (
        <div className="fade-in" style={{ marginTop: 16, padding: 16, background: "var(--surface-2, #f8f5ff)", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <strong>{String(place.name)}</strong>
              <div className="hint">
                {String(place.category)}
                {place.subcategory ? ` · ${String(place.subcategory)}` : ""}
              </div>
              <p style={{ marginTop: 8 }}>{String(place.description || place.note || "")}</p>
            </div>
            {onSelect && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelect(place)}>
                Use this spot
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
