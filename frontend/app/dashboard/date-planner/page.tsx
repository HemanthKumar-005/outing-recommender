"use client";

import { useEffect, useState } from "react";
import PlanDisplay from "../../../components/DatePlanner/PlanDisplay";
import LocationPicker, { type LocationSelection } from "../../../components/LocationPicker";
import SurpriseButton from "../../../components/SurpriseMe/SurpriseButton";
import {
  BUDGET_BANDS,
  DURATIONS,
  FALLBACK_OCCASIONS,
  fetchOccasions,
  generatePlan,
  getRecommendations,
  type DatePlan,
} from "../../../lib/api";

type Spot = {
  id: number;
  name: string;
  category: string;
  score?: number;
};

const DEFAULT_LAT = 28.6139;
const DEFAULT_LNG = 77.2090;

export default function DatePlannerPage() {
  const [step, setStep] = useState(0);
  const [occasions, setOccasions] = useState(FALLBACK_OCCASIONS);
  const [occasion, setOccasion] = useState("romantic");
  const [duration, setDuration] = useState("4-6 hours");
  const [budget, setBudget] = useState("medium");
  const [location, setLocation] = useState<LocationSelection | null>(null);
  const areaLabel = location?.city || "your area";
  const lat = location ? String(location.lat) : String(DEFAULT_LAT);
  const lng = location ? String(location.lng) : String(DEFAULT_LNG);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [plan, setPlan] = useState<DatePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOccasions().then(setOccasions);
  }, []);

  const loadSpots = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getRecommendations({
        lat: parseFloat(lat) || DEFAULT_LAT,
        lng: parseFloat(lng) || DEFAULT_LNG,
        radius_km: 25,
        city: location?.city,
        state: location?.state,
        occasion,
        outing_type: ["romantic", "first_date", "anniversary"].includes(occasion)
          ? "couple"
          : "friends",
        limit: 12,
      });
      const list: Spot[] = (data.recommendations || []).map(
        (r: { place: Spot; score: number }) => ({
          id: r.place.id,
          name: r.place.name,
          category: r.place.category,
          score: r.score,
        })
      );
      setSpots(list);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load recommendations");
    } finally {
      setLoading(false);
    }
  };

  const toggleSpot = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildPlan = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await generatePlan({
        place_ids: Array.from(selected),
        occasion,
        duration,
        budget,
        lat: parseFloat(lat) || DEFAULT_LAT,
        lng: parseFloat(lng) || DEFAULT_LNG,
        area_label: areaLabel,
        persist: true,
      });
      setPlan(res.data);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting">Date Planner</h1>
        <p className="dash-sub">
          Works anywhere in India: choose where you want to go, then occasion and preferences. Ranking and plans are config-driven — no hard-coded region.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["Area", "Occasion", "Spots", "Plan"].map((label, i) => (
          <span key={label} className={`chip ${step === i ? "active" : step > i ? "done" : ""}`}>
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}

      {step === 0 && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3>Where do you want to explore?</h3>
          <p className="hint" style={{ marginBottom: 16 }}>
            Pick any state and city/district in India. Recommendations are ranked from places near that location — not from a fixed region list.
          </p>
          <LocationPicker value={location} onChange={setLocation} />
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            disabled={!location}
            onClick={() => setStep(1)}
          >
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="card" style={{ maxWidth: 640 }}>
          <h3>Occasion & preferences</h3>
          <div className="onboard-options" style={{ marginBottom: 16 }}>
            {occasions.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`chip ${occasion === o.id ? "active" : ""}`}
                onClick={() => setOccasion(o.id)}
                title={o.description}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="form-group">
            <label className="form-label">Duration</label>
            <select className="form-select" value={duration} onChange={(e) => setDuration(e.target.value)}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Budget</label>
            <div className="onboard-options">
              {BUDGET_BANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`chip ${budget === b.id ? "active" : ""}`}
                  onClick={() => setBudget(b.id)}
                >
                  {b.label} · {b.range}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(0)}>
              Back
            </button>
            <button type="button" className="btn btn-primary" onClick={loadSpots} disabled={loading}>
              {loading ? "Finding spots…" : "Find spots"}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <SurpriseButton
            occasion={occasion}
            lat={parseFloat(lat) || DEFAULT_LAT}
            lng={parseFloat(lng) || DEFAULT_LNG}
            onSelect={(p) => {
              const id = Number(p.id);
              if (!id) return;
              setSpots((prev) =>
                prev.some((s) => s.id === id)
                  ? prev
                  : [...prev, { id, name: String(p.name), category: String(p.category) }]
              );
              setSelected((prev) => new Set(prev).add(id));
            }}
          />
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Pick stops ({selected.size} selected)</h3>
            <div className="grid-2" style={{ gap: 12 }}>
              {spots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`card ${selected.has(s.id) ? "selected" : ""}`}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    border: selected.has(s.id) ? "2px solid var(--primary, #7c3aed)" : undefined,
                  }}
                  onClick={() => toggleSpot(s.id)}
                >
                  <strong>{s.name}</strong>
                  <div className="hint">
                    {s.category}
                    {s.score != null ? ` · score ${s.score}` : ""}
                  </div>
                </button>
              ))}
            </div>
            {spots.length === 0 && (
              <p className="hint">No ranked spots yet — use Surprise Me or generate with auto-picks.</p>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={buildPlan} disabled={loading}>
                {loading ? "Building plan…" : "Generate plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && plan && (
        <div>
          <PlanDisplay plan={plan} onRefined={setPlan} />
          <button type="button" className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => setStep(0)}>
            Start over
          </button>
        </div>
      )}
    </>
  );
}
