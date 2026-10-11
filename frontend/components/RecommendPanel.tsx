"use client";

import { useState } from "react";
import LocationPicker, { type LocationSelection } from "./LocationPicker";
import { apiFetch, type RecommendResponse, type Recommendation } from "../lib/api";
import RecommendationCard from "./RecommendationCard";
import GoogleMapView, { type MapPlace } from "./GoogleMapView";

type RecommendPanelProps = {
  location?: LocationSelection | null;
  onLocationChange?: (loc: LocationSelection) => void;
  hideLocationPicker?: boolean;
};

const CATEGORIES = ["", "cafe", "restaurant", "bar", "museum", "park", "cinema", "shopping", "attraction"];
const OUTING_TYPES = ["friends", "couple", "family", "solo"];

export default function RecommendPanel({
  location: controlledLocation,
  onLocationChange,
  hideLocationPicker,
}: RecommendPanelProps = {} as RecommendPanelProps) {
  const [userId, setUserId] = useState("1");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusKm, setRadiusKm] = useState("25");
  const [category, setCategory] = useState("");
  const [occasion, setOccasion] = useState("");
  const [internalLocation, setInternalLocation] = useState<LocationSelection | null>(null);

  // New Filters & Sorting Controls
  const [openNow, setOpenNow] = useState(false);
  const [budget, setBudget] = useState("");
  const [sortBy, setSortBy] = useState("match"); // "match" | "distance" | "price"
  const [viewMode, setViewMode] = useState<"cards" | "split" | "map">("cards");

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

  const recommend = async (customOverrides?: { openNow?: boolean; budget?: string; radiusKm?: string }) => {
    if (!location && (!lat || !lng)) {
      setError("Pick a city (anywhere in India) or enter coordinates.");
      return;
    }
    setLoading(true);
    setError(null);
    setSkipped(new Set());

    const activeOpenNow = customOverrides?.openNow !== undefined ? customOverrides.openNow : openNow;
    const activeBudget = customOverrides?.budget !== undefined ? customOverrides.budget : budget;
    const activeRadius = customOverrides?.radiusKm !== undefined ? customOverrides.radiusKm : radiusKm;

    try {
      const body = {
        user_id: parseInt(userId, 10) || 1,
        lat: location?.lat ?? parseFloat(lat),
        lng: location?.lng ?? parseFloat(lng),
        city: location?.city,
        state: location?.state,
        radius_km: parseFloat(activeRadius) || 25,
        category: category || undefined,
        outing_type: outingType,
        occasion: occasion || undefined,
        open_now: activeOpenNow || undefined,
        budget: activeBudget || undefined,
        sort_by: sortBy || undefined,
        limit: 10,
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
    setToast(type === "like" ? "Saved preference ♥" : "Skipped venue");
    setTimeout(() => setToast(null), 2000);
  };

  const visible: Recommendation[] =
    result?.recommendations.filter((r) => !skipped.has(r.place.id)) || [];

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          {!hideLocationPicker && <LocationPicker value={location} onChange={setLocation} />}
        </div>

        <div className="grid-2" style={{ gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="user-id-input">User ID</label>
            <input
              id="user-id-input"
              className="form-input"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="outing-type-select">Outing type</label>
            <select
              id="outing-type-select"
              className="form-select"
              value={outingType}
              onChange={(e) => setOutingType(e.target.value)}
            >
              {OUTING_TYPES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="occasion-select">Occasion</label>
            <select
              id="occasion-select"
              className="form-select"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
            >
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

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="category-select">Category</label>
            <select
              id="category-select"
              className="form-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c || "any"} value={c}>{c || "Any"}</option>
              ))}
            </select>
          </div>

          {!location && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="lat-input">Latitude (optional)</label>
                <input
                  id="lat-input"
                  className="form-input"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="or pick a city above"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="lng-input">Longitude (optional)</label>
                <input
                  id="lng-input"
                  className="form-input"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="or pick a city above"
                />
              </div>
            </>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="radius-input">Radius (km)</label>
            <input
              id="radius-input"
              className="form-input"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
            />
          </div>
        </div>

        {/* Enhanced Filters & Sorting Bar */}
        <div
          className="filters-bar"
          style={{
            marginTop: 16,
            padding: "12px 14px",
            background: "rgba(0,0,0,0.02)",
            borderRadius: "var(--radius, 8px)",
            border: "1px solid var(--border, #e5e7eb)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Open Now Toggle Filter */}
          <label
            className="filter-toggle-label"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: "0.9rem",
              fontWeight: 500,
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              id="open-now-filter"
              checked={openNow}
              onChange={(e) => setOpenNow(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#1e7e34" }}
            />
            <span style={{ color: openNow ? "#1e7e34" : "inherit" }}>
              ⚡ Open now only
            </span>
          </label>

          {/* Budget Filter */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <label htmlFor="budget-filter-select" style={{ fontSize: "0.85rem", color: "var(--slate, #4b5563)" }}>
              Budget:
            </label>
            <select
              id="budget-filter-select"
              className="form-select-sm"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              aria-label="Filter by budget level"
            >
              <option value="">All budgets</option>
              <option value="low">Budget (₹ &lt;800 for two)</option>
              <option value="medium">Moderate (₹₹ 800–2000)</option>
              <option value="high">Upscale (₹₹₹ 2000+)</option>
            </select>
          </div>

          {/* Sort By Filter */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <label htmlFor="sort-by-select" style={{ fontSize: "0.85rem", color: "var(--slate, #4b5563)" }}>
              Sort:
            </label>
            <select
              id="sort-by-select"
              className="form-select-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort recommendation results"
            >
              <option value="match">Best match</option>
              <option value="distance">Distance (Nearest)</option>
              <option value="price">Price (Lowest first)</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 16, width: "100%", padding: "10px 16px" }}
          onClick={() => recommend()}
          disabled={loading}
        >
          {loading ? "Finding matching places…" : "Get recommendations"}
        </button>

        {error && (
          <div className="error-box fade-in" style={{ marginTop: 12 }} role="alert">
            <p className="form-error" style={{ margin: 0 }}>{error}</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 6 }}
              onClick={() => recommend()}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Loading Skeletons */}
      {loading && (
        <div className="skeleton-container fade-in" aria-label="Loading places" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="ticket ticket-skeleton">
              <div className="skeleton-image" />
              <div className="ticket-row">
                <div className="ticket-stub skeleton-stub">
                  <div className="skeleton-line" style={{ width: 32, height: 28, margin: "0 auto 6px" }} />
                  <div className="skeleton-line" style={{ width: 44, height: 12, margin: "0 auto" }} />
                </div>
                <div className="ticket-main" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="skeleton-line" style={{ width: "65%", height: 22 }} />
                  <div className="skeleton-line" style={{ width: "45%", height: 14 }} />
                  <div className="skeleton-line" style={{ width: "80%", height: 14 }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <div className="skeleton-line" style={{ width: 60, height: 24, borderRadius: 12 }} />
                    <div className="skeleton-line" style={{ width: 60, height: 24, borderRadius: 12 }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results Card */}
      {!loading && result && (
        <div className="results-card fade-in">
          <div className="context-line" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span>
              {result.context.time_of_day || "Current time"} · {result.context.day_of_week || "Today"} ·{" "}
              {result.context.weather?.condition ? `${result.context.weather.condition}, ${result.context.weather.temp_c}°C` : "Kolkata Time (IST)"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ color: "var(--muted, #6b7280)", fontSize: "0.85rem" }}>
                {visible.length} venue{visible.length === 1 ? "" : "s"} found
              </span>
              {visible.length > 0 && (
                <div className="view-mode-pill" role="tablist" aria-label="Recommendation view layout">
                  <button
                    type="button"
                    className={`view-mode-btn ${viewMode === "cards" ? "active" : ""}`}
                    onClick={() => setViewMode("cards")}
                    aria-label="Cards list view"
                  >
                    ☰ Cards
                  </button>
                  <button
                    type="button"
                    className={`view-mode-btn ${viewMode === "split" ? "active" : ""}`}
                    onClick={() => setViewMode("split")}
                    aria-label="Split cards and map view"
                  >
                    ◫ Split
                  </button>
                  <button
                    type="button"
                    className={`view-mode-btn ${viewMode === "map" ? "active" : ""}`}
                    onClick={() => setViewMode("map")}
                    aria-label="Full map view"
                  >
                    🗺️ Map
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Empty State with Helpful Next Steps */}
          {visible.length === 0 && (
            <div className="empty-state-card fade-in" style={{ padding: "32px 16px", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 8 }} aria-hidden="true">📍</div>
              <h4 style={{ margin: "0 0 6px", fontSize: "1.1rem" }}>No matching places found</h4>
              <p style={{ color: "var(--slate, #4b5563)", fontSize: "0.9rem", margin: "0 0 16px" }}>
                Try relaxing your filters or expanding your search radius to find more venues.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {openNow && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setOpenNow(false);
                      recommend({ openNow: false });
                    }}
                  >
                    Turn off &ldquo;Open now&rdquo;
                  </button>
                )}
                {budget && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setBudget("");
                      recommend({ budget: "" });
                    }}
                  >
                    Clear budget filter
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setRadiusKm("50");
                    recommend({ radiusKm: "50" });
                  }}
                >
                  Expand radius to 50 km
                </button>
              </div>
            </div>
          )}

          {/* Map Only View */}
          {visible.length > 0 && viewMode === "map" && (
            <div className="fade-in" style={{ marginTop: 14 }}>
              <GoogleMapView
                places={visible.map((rec) => ({
                  id: rec.place.id,
                  name: rec.place.name,
                  category: rec.place.category,
                  lat: rec.place.lat,
                  lng: rec.place.lng,
                  match: Math.round(rec.score * 100),
                  rating: rec.place.rating,
                  price_range: rec.place.price_range,
                  cost_for_two: rec.place.cost_for_two,
                  open_now: rec.place.open_now,
                  city: rec.place.city || location?.city,
                }))}
                center={location ? { lat: location.lat, lng: location.lng } : undefined}
                selectedId={expandedId}
                onSelectPlace={(id) => setExpandedId(id)}
                height={560}
              />
            </div>
          )}

          {/* Split Cards + Sticky Map View */}
          {visible.length > 0 && viewMode === "split" && (
            <div className="recommend-split-grid fade-in" style={{ marginTop: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {visible.map((rec) => (
                  <RecommendationCard
                    key={rec.place.id}
                    name={rec.place.name}
                    category={rec.place.category}
                    match={Math.round(rec.score * 100)}
                    rating={rec.place.rating}
                    distance_km={rec.place.distance_km}
                    price_range={rec.place.price_range}
                    cost_for_two={rec.place.cost_for_two}
                    entry_fee={rec.place.entry_fee}
                    cost_text={rec.place.cost_text}
                    entry_text={rec.place.entry_text}
                    price_symbols={rec.place.price_symbols}
                    pricing_is_estimated={rec.place.pricing_is_estimated}
                    open_now={rec.place.open_now}
                    hours_status={rec.place.hours_status}
                    hours_detail={rec.place.hours_detail}
                    today_hours={rec.place.today_hours}
                    weekly_hours={rec.place.weekly_hours || rec.place.opening_hours}
                    lat={rec.place.lat}
                    lng={rec.place.lng}
                    city={rec.place.city || location?.city}
                    reason={rec.reasons?.[0]}
                    reasons={rec.reasons}
                    showWhy={expandedId === rec.place.id}
                    whyContent={JSON.stringify(rec.score_breakdown, null, 2)}
                    onLike={() => sendFeedback(rec.place.id, "like")}
                    onSkip={() => sendFeedback(rec.place.id, "skip")}
                    onWhy={() => setExpandedId(expandedId === rec.place.id ? null : rec.place.id)}
                  />
                ))}
              </div>
              <div className="map-sticky-container">
                <GoogleMapView
                  places={visible.map((rec) => ({
                    id: rec.place.id,
                    name: rec.place.name,
                    category: rec.place.category,
                    lat: rec.place.lat,
                    lng: rec.place.lng,
                    match: Math.round(rec.score * 100),
                    rating: rec.place.rating,
                    price_range: rec.place.price_range,
                    cost_for_two: rec.place.cost_for_two,
                    open_now: rec.place.open_now,
                    city: rec.place.city || location?.city,
                  }))}
                  center={location ? { lat: location.lat, lng: location.lng } : undefined}
                  selectedId={expandedId}
                  onSelectPlace={(id) => setExpandedId(id)}
                  height={540}
                />
              </div>
            </div>
          )}

          {/* Cards Only View */}
          {visible.length > 0 && viewMode === "cards" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              {visible.map((rec) => (
                <RecommendationCard
                  key={rec.place.id}
                  name={rec.place.name}
                  category={rec.place.category}
                  match={Math.round(rec.score * 100)}
                  rating={rec.place.rating}
                  distance_km={rec.place.distance_km}
                  price_range={rec.place.price_range}
                  cost_for_two={rec.place.cost_for_two}
                  entry_fee={rec.place.entry_fee}
                  cost_text={rec.place.cost_text}
                  entry_text={rec.place.entry_text}
                  price_symbols={rec.place.price_symbols}
                  pricing_is_estimated={rec.place.pricing_is_estimated}
                  open_now={rec.place.open_now}
                  hours_status={rec.place.hours_status}
                  hours_detail={rec.place.hours_detail}
                  today_hours={rec.place.today_hours}
                  weekly_hours={rec.place.weekly_hours || rec.place.opening_hours}
                  lat={rec.place.lat}
                  lng={rec.place.lng}
                  city={rec.place.city || location?.city}
                  reason={rec.reasons?.[0]}
                  reasons={rec.reasons}
                  showWhy={expandedId === rec.place.id}
                  whyContent={JSON.stringify(rec.score_breakdown, null, 2)}
                  onLike={() => sendFeedback(rec.place.id, "like")}
                  onSkip={() => sendFeedback(rec.place.id, "skip")}
                  onWhy={() => setExpandedId(expandedId === rec.place.id ? null : rec.place.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
