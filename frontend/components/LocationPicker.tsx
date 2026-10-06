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

  if (loading) {
    return <p className="hint">Loading states & cities across India…</p>;
  }

  return (
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
      {value?.city && (
        <p className="hint" style={{ gridColumn: "1 / -1" }}>
          Exploring near <strong>{value.city}</strong>
          {value.state ? `, ${value.state}` : ""} · {value.lat.toFixed(3)}, {value.lng.toFixed(3)}
        </p>
      )}
    </div>
  );
}
