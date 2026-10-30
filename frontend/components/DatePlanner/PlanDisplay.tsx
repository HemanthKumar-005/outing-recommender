"use client";

import { useState } from "react";
import type { DatePlan } from "../../lib/api";
import { refinePlan, reorderPlan, swapPlanStop, fetchItineraryBackups, shareItinerary, itineraryCalendarUrl } from "../../lib/api";
import MapView, { type MapPlace } from "../MapView";
import { Icons } from "../Icons";

type Props = {
  plan: DatePlan;
  onRefined?: (plan: DatePlan) => void;
};

const SUGGESTIONS = [
  "Add craft breweries",
  "More scenic viewpoints",
  "Add a cozy cafe",
  "Budget-friendly options",
  "More active & adventurous",
  "Quiet & intimate vibe",
];

export default function PlanDisplay({ plan, onRefined }: Props) {
  const [feedback, setFeedback] = useState("");
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [swappingStopId, setSwappingStopId] = useState<number | null>(null);
  const [backups, setBackups] = useState<Array<{ id: number; name: string; category: string; rating?: number; cost_for_two?: number }>>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const refine = async (customText?: string) => {
    const text = (customText ?? feedback).trim();
    if (!plan.itinerary_id || !text) return;
    setRefining(true);
    setError("");
    try {
      const res = await refinePlan(plan.itinerary_id, text);
      if (res.data && onRefined) onRefined(res.data as DatePlan);
      setFeedback("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Plan refinement failed. Please try again.");
    } finally {
      setRefining(false);
    }
  };

  const handleMoveStop = async (index: number, direction: -1 | 1) => {
    if (!plan.itinerary_id) return;
    const items = (plan.items as Array<{ place_id: number }>) || [];
    const placeIds = items.map((it) => it.place_id);
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= placeIds.length) return;

    const newIds = [...placeIds];
    const temp = newIds[index];
    newIds[index] = newIds[targetIdx];
    newIds[targetIdx] = temp;

    setActionLoading(true);
    setError("");
    try {
      const res = await reorderPlan(plan.itinerary_id, newIds);
      if (res.data && onRefined) onRefined(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reorder stops.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenSwap = async (placeId: number) => {
    setSwappingStopId(placeId);
    if (!plan.itinerary_id || backups.length > 0) return;
    setLoadingBackups(true);
    try {
      const res = await fetchItineraryBackups(plan.itinerary_id);
      if (res.backups) setBackups(res.backups);
    } catch {
      // Gracefully continue with any local alternatives
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleSelectSwap = async (oldPlaceId: number, newPlaceId: number) => {
    if (!plan.itinerary_id) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await swapPlanStop(plan.itinerary_id, oldPlaceId, newPlaceId);
      if (res.data && onRefined) onRefined(res.data);
      setSwappingStopId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to swap stop.");
    } finally {
      setActionLoading(false);
    }
  };

  const copySummary = () => {
    const stops = (plan.timeline_meta || [])
      .map((s) => `${s.time} — ${s.place_name || s.activity} (${s.activity})`)
      .join("\n");
    const summary = `${plan.title}\n${plan.description}\n\nTimeline:\n${stops}\n\nEstimated Budget: ${
      plan.budget_estimate || "Flexible"
    }\nBackup: ${plan.backup_plan || "Indoor cafes"}`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const openRouteInGoogleMaps = () => {
    const stops = plan.timeline_meta || [];
    if (stops.length === 0) return;
    const names = stops.map((s) => s.place_name).filter(Boolean);
    if (names.length === 1) {
      const q = encodeURIComponent(String(names[0]));
      window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
    } else if (names.length >= 2) {
      const origin = encodeURIComponent(String(names[0]));
      const destination = encodeURIComponent(String(names[names.length - 1]));
      const waypoints = names
        .slice(1, -1)
        .map((n) => encodeURIComponent(String(n)))
        .join("|");
      const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
        waypoints ? `&waypoints=${waypoints}` : ""
      }`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const openStopInMaps = (stopName: string) => {
    const q = encodeURIComponent(stopName);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="card fade-in" style={{ border: "1px solid var(--hairline)" }}>
      {/* Plan Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div>
          <span className="eyebrow" style={{ color: "var(--brass-bright)", fontWeight: 700 }}>
            {plan.area_label ? `Date Plan in ${plan.area_label}` : "Curated Date Experience"}
          </span>
          <h2 style={{ fontSize: "1.85rem", fontWeight: 700, margin: "4px 0 8px", color: "var(--slate-strong)" }}>
            {plan.title}
          </h2>
          <p className="dash-sub" style={{ fontSize: "1rem", lineHeight: 1.6, maxWidth: 650, color: "var(--slate)" }}>
            {plan.description}
          </p>
        </div>

        {/* Quick action buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={copySummary} title="Copy plan text">
            {copied ? "✓ Copied!" : "📋 Copy Plan"}
          </button>
          {plan.itinerary_id && (
            <>
              <a className="btn btn-secondary btn-sm" href={itineraryCalendarUrl(plan.itinerary_id)} download title="Add to any calendar app (.ics file)">
                📅 Add to calendar
              </a>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  try {
                    const { path } = await shareItinerary(plan.itinerary_id as number);
                    const url = `${window.location.origin}${path}`;
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    /* ignore */
                  }
                }}
                title="Copy a read-only link to this plan"
              >
                🔗 Share link
              </button>
            </>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={openRouteInGoogleMaps}>
            🗺️ Open in Google Maps ↗
          </button>
        </div>
      </div>

      {/* Meta Chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "16px 0 24px" }}>
        {plan.occasion && (
          <span className="chip active" style={{ textTransform: "capitalize" }}>
            ✨ {plan.occasion.replace(/_/g, " ")}
          </span>
        )}
        {plan.duration && <span className="chip">⏱️ {plan.duration}</span>}
        {plan.budget_estimate && <span className="chip">💰 {plan.budget_estimate}</span>}
      </div>

      {/* Brewery Alert Notice */}
      {plan.includes_breweries && (
        <div className="notice-box notice-warning">
          <span style={{ fontSize: "1.3rem" }}>🍻</span>
          <div>
            <strong style={{ display: "block", marginBottom: 2 }}>Craft Brewery Route Included</strong>
            <span>Pace yourself with beer flights, stay hydrated, and arrange safe ride-sharing between stops.</span>
          </div>
        </div>
      )}

      {/* Weather-Change Rescheduling Banner */}
      {plan.backup_plan && (
        <div
          className="weather-reschedule-banner fade-in"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            padding: "14px 18px",
            borderRadius: "var(--radius)",
            background: "linear-gradient(135deg, rgba(20, 184, 166, 0.12), rgba(59, 130, 246, 0.08))",
            border: "1px solid rgba(20, 184, 166, 0.3)",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(20, 184, 166, 0.2)", color: "var(--teal-400)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icons.CloudSun size={22} />
            </div>
            <div>
              <strong style={{ fontSize: "0.95rem", color: "var(--text-primary)", display: "block" }}>
                Weather-Safe Rescheduling Available
              </strong>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                {plan.backup_plan}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => refine("Swap outdoor stops for indoor weather-safe venues")}
            disabled={refining}
            style={{ borderColor: "var(--teal-400)", color: "var(--teal-400)" }}
          >
            {refining ? "Rescheduling…" : "Apply Weather Backup ⚡"}
          </button>
        </div>
      )}

      {/* Interactive Google Maps Route & Road Navigation */}
      {(() => {
        const mapPlaces: MapPlace[] = (((plan.items as any[]) || []))
          .filter((it) => it && it.lat && it.lng)
          .map((it, idx) => ({
            id: it.place_id || idx + 1,
            name: it.name || `Stop ${idx + 1}`,
            category: it.category || "attraction",
            lat: it.lat,
            lng: it.lng,
            city: plan.area_label,
          }));

        if (mapPlaces.length === 0) return null;

        return (
          <div style={{ margin: "20px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, color: "var(--slate-strong)" }}>
                🗺️ Interactive Itinerary Route
              </h3>
              <span style={{ fontSize: "0.8rem", color: "var(--slate)" }}>
                {mapPlaces.length} sequenced stops
              </span>
            </div>

            {plan.routing && plan.routing.total_distance_km > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "10px 14px",
                  marginBottom: 12,
                  borderRadius: "var(--radius)",
                  background: "rgba(59, 130, 246, 0.08)",
                  border: "1px solid rgba(59, 130, 246, 0.2)",
                  fontSize: "0.85rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🚗</span>
                  <span style={{ fontWeight: 600, color: "var(--slate-strong)" }}>
                    Urban Road Navigation: {plan.routing.total_distance_km} km total driving · ~{Math.round(plan.routing.total_duration_min)} mins drive time
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(59, 130, 246, 0.15)",
                    color: "#3b82f6",
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {plan.routing.provider === "haversine_estimate" ? "📍 Straight-line estimate" : "🛣️ Road route"}
                </span>
              </div>
            )}

            <MapView places={mapPlaces} routeMode={true} height={320} />
          </div>
        );
      })()}

      {/* Timeline Stops with Reordering and Swapping */}
      {plan.timeline_meta && plan.timeline_meta.length > 0 && (
        <div style={{ margin: "28px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--slate-strong)" }}>
              🗓️ Date Schedule & Interactive Stops
            </h3>
            {actionLoading && (
              <span style={{ fontSize: "0.85rem", color: "var(--brass-bright)" }}>
                Recalculating route & schedule...
              </span>
            )}
          </div>

          <div className="timeline">
            {plan.timeline_meta.map((stop, i) => (
              <div key={`${stop.time}-${i}`} style={{ marginBottom: 12 }}>
                <div className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-time">{stop.time}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div className="timeline-place" style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                        {stop.place_name || stop.activity}
                      </div>
                      <div className="timeline-meta" style={{ marginTop: 4 }}>
                        <span>{stop.activity}</span>
                        {stop.category && (
                          <span
                            style={{
                              marginLeft: 8,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "rgba(224, 94, 58, 0.15)",
                              color: "var(--coral-400)",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                            }}
                          >
                            {stop.category}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {/* Reorder Buttons */}
                      <button
                        type="button"
                        className="btn-tiny"
                        disabled={i === 0 || actionLoading}
                        onClick={() => handleMoveStop(i, -1)}
                        title="Move stop earlier in route"
                        style={{ padding: "3px 6px" }}
                      >
                        <Icons.ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-tiny"
                        disabled={i === (plan.timeline_meta?.length || 1) - 1 || actionLoading}
                        onClick={() => handleMoveStop(i, 1)}
                        title="Move stop later in route"
                        style={{ padding: "3px 6px" }}
                      >
                        <Icons.ChevronDown size={13} />
                      </button>

                      {/* Swap Button */}
                      {stop.place_id && (
                        <button
                          type="button"
                          className="btn-tiny"
                          style={{
                            background: swappingStopId === stop.place_id ? "var(--coral-500)" : undefined,
                            color: swappingStopId === stop.place_id ? "#fff" : undefined,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          onClick={() =>
                            swappingStopId === stop.place_id
                              ? setSwappingStopId(null)
                              : handleOpenSwap(Number(stop.place_id))
                          }
                          title="Swap with backup venue"
                        >
                          <Icons.RefreshCw size={12} /> Swap
                        </button>
                      )}

                      {/* Maps Button */}
                      {stop.place_name && (
                        <button
                          type="button"
                          className="btn-tiny"
                          style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }}
                          onClick={() => openStopInMaps(String(stop.place_name))}
                          title="View this stop on Google Maps"
                        >
                          <Icons.Navigation size={12} /> Maps <Icons.ArrowUpRight size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Swap Picker Drawer */}
                  {swappingStopId === stop.place_id && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        background: "var(--ink-2)",
                        borderRadius: "var(--radius)",
                        border: "1px solid var(--hairline)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--slate-strong)" }}>
                          Choose replacement for {stop.place_name}:
                        </span>
                        <button
                          type="button"
                          className="btn-tiny"
                          onClick={() => setSwappingStopId(null)}
                        >
                          ✕ Cancel
                        </button>
                      </div>

                      {loadingBackups ? (
                        <p style={{ fontSize: "0.82rem", color: "var(--slate)", margin: 0 }}>
                          Loading available nearby venues...
                        </p>
                      ) : backups.length === 0 ? (
                        <p style={{ fontSize: "0.82rem", color: "var(--slate)", margin: 0 }}>
                          No alternative venues available. Try refining the plan instead.
                        </p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                          {backups.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleSelectSwap(Number(stop.place_id), b.id)}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                textAlign: "left",
                                padding: "6px 10px",
                                borderRadius: "var(--radius-sm)",
                                background: "var(--ink-3)",
                                border: "1px solid var(--hairline)",
                                color: "var(--slate-strong)",
                                fontSize: "0.85rem",
                                cursor: "pointer",
                              }}
                            >
                              <div>
                                <strong style={{ display: "block" }}>{b.name}</strong>
                                <span style={{ fontSize: "0.75rem", color: "var(--slate)", textTransform: "capitalize" }}>
                                  {b.category} {b.rating ? `· ⭐ ${b.rating.toFixed(1)}` : ""}
                                </span>
                              </div>
                              <span style={{ fontSize: "0.8rem", color: "var(--brass-bright)" }}>
                                Select →
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Per-Leg Driving Transit Connector */}
                {stop.travel_to_next && (
                  <div
                    style={{
                      margin: "8px 0 12px 36px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 12px",
                      borderRadius: 999,
                      background: "rgba(59, 130, 246, 0.08)",
                      border: "1px dashed rgba(59, 130, 246, 0.3)",
                      fontSize: "0.78rem",
                      color: "var(--slate-strong)",
                    }}
                  >
                    <span>🚗</span>
                    <span>
                      <strong>{Math.round(stop.travel_to_next.duration_min)} mins drive</strong> ({stop.travel_to_next.distance_km} km) to next venue ↓
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Romantic & Date Tips */}
      {plan.romantic_tips && plan.romantic_tips.length > 0 && (
        <div
          style={{
            marginTop: 24,
            padding: "16px 20px",
            background: "var(--ink-3)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--hairline)",
          }}
        >
          <h4 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 8, color: "var(--slate-strong)" }}>
            <span>💡</span> Pro Date Tips for This Outing
          </h4>
          <ul style={{ paddingLeft: 20, margin: 0, color: "var(--slate)" }}>
            {plan.romantic_tips.map((t) => (
              <li key={t} style={{ marginBottom: 6, lineHeight: 1.5, fontSize: "0.92rem" }}>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Plan Refinement */}
      {plan.itinerary_id && (
        <div style={{ marginTop: 28, borderTop: "1px solid var(--hairline)", paddingTop: 20 }}>
          <h4 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 8, color: "var(--slate-strong)" }}>
            ✨ Want to customize or tweak this plan?
          </h4>
          <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
            Tell our planner what to adjust — add breweries, find scenic spots, change timing, or tweak budget:
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                onClick={() => refine(s)}
                disabled={refining}
              >
                + {s}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") refine();
              }}
              placeholder="e.g. swap first stop for a quiet cafe, add a sunset view, make it cheaper…"
              disabled={refining}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!feedback.trim() || refining}
              onClick={() => refine()}
            >
              {refining ? "Refining…" : "Refine Plan"}
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
