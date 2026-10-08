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
  rating?: number;
  city?: string;
};

const DEFAULT_LAT = 12.9716; // Bengaluru
const DEFAULT_LNG = 77.5946;

const INTERESTS = [
  { label: "Craft Breweries", emoji: "🍻", tag: "brewery" },
  { label: "Cozy Cafés", emoji: "☕", tag: "cafe" },
  { label: "Scenic Viewpoints", emoji: "🌄", tag: "viewpoint" },
  { label: "Fine Dining", emoji: "🍽️", tag: "restaurant" },
  { label: "Nature & Parks", emoji: "🌳", tag: "park" },
  { label: "Heritage & Temples", emoji: "🛕", tag: "heritage" },
  { label: "Shopping & Malls", emoji: "🛍️", tag: "shopping" },
  { label: "Entertainment", emoji: "🎭", tag: "entertainment" },
];

export default function DatePlannerPage() {
  const [step, setStep] = useState(0);
  const [occasions, setOccasions] = useState(FALLBACK_OCCASIONS);
  const [occasion, setOccasion] = useState("romantic");
  const [duration, setDuration] = useState("4-6 hours");
  const [budget, setBudget] = useState("medium");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["brewery", "restaurant"]);
  const [location, setLocation] = useState<LocationSelection | null>({
    state: "Karnataka",
    city: "Bengaluru",
    lat: 12.9716,
    lng: 77.5946,
  });
  const areaLabel = location?.city || "Karnataka";
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

  const toggleInterest = (tag: string) => {
    setSelectedInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const loadSpots = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getRecommendations({
        lat: parseFloat(lat) || DEFAULT_LAT,
        lng: parseFloat(lng) || DEFAULT_LNG,
        radius_km: 35,
        city: location?.city,
        state: location?.state,
        occasion,
        outing_type: ["romantic", "first_date", "anniversary"].includes(occasion)
          ? "couple"
          : "friends",
        limit: 15,
      });

      const list: Spot[] = (data.recommendations || []).map(
        (r: { place: Spot; score: number }) => ({
          id: r.place.id,
          name: r.place.name,
          category: r.place.category,
          score: r.score,
          rating: r.place.rating,
          city: r.place.city,
        })
      );

      setSpots(list);
      // Auto-select top 2-3 spots by default so user can immediately generate or customize
      if (list.length > 0) {
        setSelected(new Set(list.slice(0, 3).map((s) => s.id)));
      } else {
        setSelected(new Set());
      }
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load recommendations for this area");
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

  const selectTopSpots = () => {
    setSelected(new Set(spots.slice(0, 4).map((s) => s.id)));
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
      setError(e instanceof Error ? e.message : "Plan generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openInMaps = (spotName: string) => {
    const q = encodeURIComponent(`${spotName} ${areaLabel}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting" style={{ fontSize: "2rem", fontWeight: 700 }}>
          💖 Date Planner
        </h1>
        <p className="dash-sub" style={{ fontSize: "1rem", marginTop: 4 }}>
          Craft memorable dates with curated itineraries, brewery tours, and romantic stops across Karnataka & all of India.
        </p>
      </div>

      {/* Progress Breadcrumbs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        {["1. Destination", "2. Date Vibe & Budget", "3. Curate Stops", "4. Complete Plan"].map((label, i) => (
          <span
            key={label}
            className={`chip ${step === i ? "active" : step > i ? "done" : ""}`}
            style={{ fontSize: "0.85rem", padding: "6px 14px" }}
          >
            {label}
          </span>
        ))}
      </div>

      {error && <p className="form-error" style={{ marginBottom: 16 }}>{error}</p>}

      {/* STEP 0: Destination Selection */}
      {step === 0 && (
        <div className="card fade-in" style={{ maxWidth: 640 }}>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 6, color: "var(--slate-strong)" }}>
            📍 Where are you going on your date?
          </h3>
          <p className="hint" style={{ marginTop: 0, marginBottom: 18 }}>
            Choose a romantic destination in Karnataka or anywhere across India.
          </p>

          <LocationPicker value={location} onChange={setLocation} />

          <button
            type="button"
            className="btn btn-primary btn-block"
            style={{ marginTop: 20 }}
            disabled={!location}
            onClick={() => setStep(1)}
          >
            Continue to Date Vibe & Preferences →
          </button>
        </div>
      )}

      {/* STEP 1: Occasion, Budget, Duration, & Interests */}
      {step === 1 && (
        <div className="card fade-in" style={{ maxWidth: 680 }}>
          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: 6, color: "var(--slate-strong)" }}>
            ✨ Date Type & Preferences for {areaLabel}
          </h3>
          <p className="hint" style={{ marginTop: 0, marginBottom: 16 }}>
            Customize the vibe so your schedule and backup plan match your taste.
          </p>

          {/* Occasion / Date Type */}
          <div className="form-group">
            <label className="form-label">Occasion / Date Type</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
          </div>

          {/* Duration */}
          <div className="form-group">
            <label className="form-label">Duration</label>
            <select className="form-select" value={duration} onChange={(e) => setDuration(e.target.value)}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  ⏱️ {d}
                </option>
              ))}
            </select>
          </div>

          {/* Budget */}
          <div className="form-group">
            <label className="form-label">Budget per couple</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {BUDGET_BANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`chip ${budget === b.id ? "active" : ""}`}
                  onClick={() => setBudget(b.id)}
                >
                  💰 {b.label} · {b.range}
                </button>
              ))}
            </div>
          </div>

          {/* Date Interests */}
          <div className="form-group">
            <label className="form-label">Special Interests & Preferences</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {INTERESTS.map((item) => {
                const active = selectedInterests.includes(item.tag);
                return (
                  <button
                    key={item.tag}
                    type="button"
                    className={`chip ${active ? "active" : ""}`}
                    onClick={() => toggleInterest(item.tag)}
                  >
                    <span>{item.emoji}</span> {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(0)}>
              ← Back
            </button>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={loadSpots} disabled={loading}>
              {loading ? "Searching Best Spots…" : "Find Spots in " + areaLabel + " →"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Pick Stops & Surprise Me Integration */}
      {step === 2 && (
        <div className="fade-in">
          {/* Integrated Surprise Me Widget */}
          <SurpriseButton
            occasion={occasion}
            city={location?.city}
            lat={parseFloat(lat) || DEFAULT_LAT}
            lng={parseFloat(lng) || DEFAULT_LNG}
            onSelect={(p) => {
              const id = Number(p.id);
              if (!id) return;
              setSpots((prev) =>
                prev.some((s) => s.id === id)
                  ? prev
                  : [{ id, name: String(p.name), category: String(p.category), city: String(p.city || "") }, ...prev]
              );
              setSelected((prev) => new Set(prev).add(id));
            }}
          />

          {/* Stops List */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--slate-strong)" }}>
                  Curate Stops in {areaLabel} ({selected.size} selected)
                </h3>
                <p className="hint" style={{ margin: "4px 0 0" }}>
                  Pick 2 to 4 stops for your timeline, or use the auto-pick button below.
                </p>
              </div>

              {spots.length > 0 && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={selectTopSpots}>
                  ✨ Auto-Pick Top Stops
                </button>
              )}
            </div>

            <div className="grid-2" style={{ gap: 14 }}>
              {spots.map((s) => {
                const isSelected = selected.has(s.id);
                return (
                  <div
                    key={s.id}
                    className={`card ${isSelected ? "selected" : ""}`}
                    style={{
                      padding: 16,
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => toggleSpot(s.id)}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <strong style={{ fontSize: "1.1rem", color: "var(--slate-strong)" }}>{s.name}</strong>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background: isSelected ? "var(--brass)" : "var(--ink-3)",
                            color: isSelected ? "#1A1210" : "var(--slate)",
                          }}
                        >
                          {isSelected ? "✓ Added" : "+ Add"}
                        </span>
                      </div>

                      <div className="hint" style={{ margin: "6px 0 0", color: "var(--slate)" }}>
                        <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{s.category}</span>
                        {s.city ? ` · ${s.city}` : ""}
                        {s.rating != null ? ` · ★ ${s.rating.toFixed(1)}` : ""}
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn-tiny"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInMaps(s.name);
                        }}
                      >
                        📍 Maps ↗
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {spots.length === 0 && (
              <div style={{ padding: "24px 16px", textAlign: "center", background: "var(--ink-3)", borderRadius: "var(--radius)" }}>
                <p style={{ margin: "0 0 10px", color: "var(--slate-strong)", fontWeight: 600 }}>
                  No spots found in our catalog directly inside this city radius.
                </p>
                <p className="hint" style={{ margin: 0 }}>
                  Use the <strong>🎲 Surprise Date Spot Generator</strong> above to pull exciting spots from Karnataka and beyond!
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={buildPlan}
                disabled={loading}
              >
                {loading ? "Crafting Date Plan…" : `Generate Complete Date Plan (${selected.size} stops) →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Generated Plan */}
      {step === 3 && plan && (
        <div className="fade-in">
          <PlanDisplay plan={plan} onRefined={setPlan} />
          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
              ← Adjust Preferences
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setStep(0)}>
              Plan Another Date 💖
            </button>
          </div>
        </div>
      )}
    </>
  );
}
