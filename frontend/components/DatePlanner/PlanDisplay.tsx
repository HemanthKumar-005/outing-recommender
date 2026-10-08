"use client";

import { useState } from "react";
import type { DatePlan } from "../../lib/api";
import { refinePlan } from "../../lib/api";

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

      {/* Weather Backup Notice */}
      {plan.backup_plan && (
        <div className="notice-box notice-success">
          <span style={{ fontSize: "1.3rem" }}>⛅</span>
          <div>
            <strong style={{ display: "block", marginBottom: 2 }}>Weather-Safe Backup Plan</strong>
            <span>{plan.backup_plan}</span>
          </div>
        </div>
      )}

      {/* Timeline Stops */}
      {plan.timeline_meta && plan.timeline_meta.length > 0 && (
        <div style={{ margin: "28px 0" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 16, color: "var(--slate-strong)" }}>
            🗓️ Date Schedule & Stops
          </h3>
          <div className="timeline">
            {plan.timeline_meta.map((stop, i) => (
              <div className="timeline-item" key={`${stop.time}-${i}`}>
                <div className="timeline-dot" />
                <div className="timeline-time">{stop.time}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
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
                            background: "rgba(224, 122, 95, 0.15)",
                            color: "var(--brass-bright)",
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

                  {stop.place_name && (
                    <button
                      type="button"
                      className="btn-tiny"
                      style={{ whiteSpace: "nowrap" }}
                      onClick={() => openStopInMaps(String(stop.place_name))}
                      title="View this stop on Google Maps"
                    >
                      📍 Maps ↗
                    </button>
                  )}
                </div>
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
