"use client";

import { useState } from "react";
import type { DatePlan } from "../../lib/api";
import { refinePlan } from "../../lib/api";

type Props = {
  plan: DatePlan;
  onRefined?: (plan: DatePlan) => void;
};

export default function PlanDisplay({ plan, onRefined }: Props) {
  const [feedback, setFeedback] = useState("");
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState("");

  const refine = async () => {
    if (!plan.itinerary_id || !feedback.trim()) return;
    setRefining(true);
    setError("");
    try {
      const res = await refinePlan(plan.itinerary_id, feedback.trim());
      if (res.data && onRefined) onRefined(res.data as DatePlan);
      setFeedback("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refine failed");
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="card fade-in">
      <h2 style={{ marginBottom: 8 }}>{plan.title}</h2>
      <p className="dash-sub">{plan.description}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "12px 0 20px" }}>
        {plan.occasion && <span className="chip active">{plan.occasion.replace(/_/g, " ")}</span>}
        {plan.duration && <span className="chip">{plan.duration}</span>}
        {plan.budget_estimate && <span className="chip">💰 {plan.budget_estimate}</span>}
      </div>

      {plan.timeline_meta && plan.timeline_meta.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12 }}>Timeline</h3>
          <div className="timeline">
            {plan.timeline_meta.map((stop, i) => (
              <div className="timeline-item" key={`${stop.time}-${i}`}>
                <div className="timeline-dot" />
                <div className="timeline-time">{stop.time}</div>
                <div className="timeline-place">{stop.place_name || stop.activity}</div>
                <div className="timeline-meta">
                  {stop.activity}
                  {stop.category ? ` · ${stop.category}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.romantic_tips && plan.romantic_tips.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 8 }}>Tips</h3>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {plan.romantic_tips.map((t) => (
              <li key={t} style={{ marginBottom: 6 }}>
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.backup_plan && (
        <div className="hint" style={{ marginBottom: 16, padding: 12, background: "#f0fdf4", borderRadius: 8 }}>
          <strong>Backup:</strong> {plan.backup_plan}
        </div>
      )}

      {plan.includes_breweries && (
        <div className="hint" style={{ marginBottom: 16, padding: 12, background: "#fffbeb", borderRadius: 8 }}>
          🍻 Brewery route — pace yourselves and consider ride-sharing.
        </div>
      )}

      {plan.itinerary_id && (
        <div style={{ marginTop: 16, borderTop: "1px solid #eee", paddingTop: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Want to improve this plan?</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. more adventurous, add breweries, cheaper…"
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!feedback.trim() || refining}
              onClick={refine}
            >
              {refining ? "Refining…" : "Refine"}
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
