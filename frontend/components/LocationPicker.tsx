"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

export type LocationSelection = {
  state: string;
  city: string;
  lat: number;
  lng: number;
};

type City = { state: string; name: string; lat: number; lng: number };

const POPULAR_DESTINATIONS = [
  { label: "Bengaluru", state: "Karnataka", city: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { label: "Mysuru", state: "Karnataka", city: "Mysuru", lat: 12.2958, lng: 76.6394 },
  { label: "Coorg", state: "Karnataka", city: "Coorg", lat: 12.4244, lng: 75.7382 },
  { label: "Gokarna", state: "Karnataka", city: "Gokarna", lat: 14.5479, lng: 74.3188 },
  { label: "Hampi", state: "Karnataka", city: "Hampi", lat: 15.335, lng: 76.46 },
  { label: "Chikmagalur", state: "Karnataka", city: "Chikmagalur", lat: 13.3153, lng: 75.7754 },
  { label: "Mangaluru", state: "Karnataka", city: "Mangaluru", lat: 12.9141, lng: 74.856 },
  { label: "Goa", state: "Goa", city: "Panaji", lat: 15.4909, lng: 73.8278 },
  { label: "Mumbai", state: "Maharashtra", city: "Mumbai", lat: 19.076, lng: 72.8777 },
  { label: "Jaipur", state: "Rajasthan", city: "Jaipur", lat: 26.9124, lng: 75.7873 },
];

type Props = {
  value?: LocationSelection | null;
  onChange: (loc: LocationSelection) => void;
};

export default function LocationPicker({ value, onChange }: Props) {
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [state, setState] = useState(value?.state || "");
  const [city, setCity] = useState(value?.city || "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("places/locations");
        if (!res.ok) throw new Error("locations failed");
        const data = await res.json();
        if (!cancelled) {
          setStates(data.states || []);
          setCities(data.cities || []);
        }
      } catch {
        if (!cancelled) {
          setStates([]);
          setCities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const citiesInState = useMemo(
    () => cities.filter((c) => !state || c.state === state),
    [cities, state]
  );

  const pickCity = (name: string) => {
    setCity(name);
    const hit = cities.find((c) => c.name === name && (!state || c.state === state));
    if (hit) {
      onChange({ state: hit.state, city: hit.name, lat: hit.lat, lng: hit.lng });
    }
  };

  const pickState = (s: string) => {
    setState(s);
    setCity("");
  };

  const pickQuick = (dest: (typeof POPULAR_DESTINATIONS)[0]) => {
    setState(dest.state);
    setCity(dest.city);
    onChange({ state: dest.state, city: dest.city, lat: dest.lat, lng: dest.lng });
  };

  if (loading) {
    return <p className="hint">Loading locations across India…</p>;
  }

  return (
    <div>
      {/* Quick destination chips */}
      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--slate-strong)", display: "block", marginBottom: 6 }}>
          ✨ Quick Select Popular Outing & Date Spots:
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {POPULAR_DESTINATIONS.map((d) => {
            const isSelected = value?.city === d.city;
            return (
              <button
                key={d.city}
                type="button"
                className={`chip ${isSelected ? "active" : ""}`}
                style={{ fontSize: "0.8rem", padding: "5px 12px" }}
                onClick={() => pickQuick(d)}
              >
                📍 {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid-2" style={{ gap: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">State / UT</label>
          <select className="form-select" value={state} onChange={(e) => pickState(e.target.value)}>
            <option value="">Select state</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">City / District</label>
          <select
            className="form-select"
            value={city}
            onChange={(e) => pickCity(e.target.value)}
            disabled={!state && citiesInState.length === 0}
          >
            <option value="">Select city / district</option>
            {citiesInState.map((c) => (
              <option key={`${c.state}-${c.name}`} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {value?.city && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 14px",
            background: "var(--ink-3)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--hairline)",
            fontSize: "0.85rem",
            color: "var(--slate-strong)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>🎯</span>
          <span>
            Selected destination: <strong>{value.city}</strong>
            {value.state ? `, ${value.state}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
