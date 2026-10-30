"use client";

import { useState } from "react";
import { GROUP_PERSONAS, GROUP_RESULT } from "../lib/demo-data";
import { fetchGroupRecommendations, type GroupRecommendation } from "../lib/api";
import { Icons } from "./Icons";

export default function GroupPlanner() {
  const [strategy, setStrategy] = useState<"least_misery" | "average" | "borda">("least_misery");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([1, 2, 3]);
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState(false);
  const [groupResults, setGroupResults] = useState<GroupRecommendation[] | null>(null);

  const toggleUser = (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      if (selectedUserIds.length > 1) {
        setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
      }
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const run = async () => {
    setFinding(true);
    setFound(false);
    setGroupResults(null);

    try {
      const res = await fetchGroupRecommendations({
        user_ids: selectedUserIds,
        lat: 12.9716, // Bangalore default
        lng: 77.5946,
        strategy,
        radius_km: 25,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.recommendations && data.recommendations.length > 0) {
          setGroupResults(data.recommendations);
          setFound(true);
          return;
        }
      }
    } catch {
      /* Fallback gracefully to simulated demo result */
    } finally {
      setFinding(false);
    }

    setTimeout(() => {
      setFound(true);
    }, 400);
  };

  const getStrategyInfo = () => {
    switch (strategy) {
      case "least_misery":
        return {
          title: "Least-Misery Consensus Rule",
          desc: "Prioritizes the member who would be least satisfied. Guarantees that nobody in your group is stuck with a venue they dislike.",
          badge: "No Vetoes",
          color: "var(--teal-400)",
        };
      case "borda":
        return {
          title: "Borda Count Voting Rule",
          desc: "Ranks all candidates via positional ballots (1st place gets N points, 2nd gets N-1). Produces the most balanced democratic choice.",
          badge: "Ranked Ballot",
          color: "var(--coral-400)",
        };
      case "average":
        return {
          title: "Utilitarian Average Rule",
          desc: "Computes the exact mathematical mean of individual taste embeddings. Best for groups with open, flexible preferences.",
          badge: "Equal Weight",
          color: "var(--violet-400)",
        };
    }
  };

  const info = getStrategyInfo();

  return (
    <div className="card" style={{ position: "relative" }}>
      {/* Strategy selector pills */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
          <span className="eyebrow" style={{ margin: 0, color: "var(--coral-400)" }}>Group Consensus Algorithm</span>
          <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { id: "least_misery", label: "🛡️ Least Misery", desc: "Nobody hates it" },
              { id: "borda", label: "🗳️ Borda Count", desc: "Ranked voting" },
              { id: "average", label: "⚖️ Average", desc: "Equal utilitarian weight" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                className={`btn btn-sm ${strategy === s.id ? "btn-primary" : "btn-secondary"}`}
                style={{ fontSize: "0.8rem", padding: "5px 12px" }}
                onClick={() => setStrategy(s.id as any)}
                title={s.desc}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic rule explainer banner */}
        <div
          className="fade-in"
          style={{
            padding: "12px 14px",
            background: "var(--bg-surface-elevated)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: 580 }}>
            <strong style={{ color: info.color }}>{info.title}: </strong>
            {info.desc}
          </div>
          <span className="badge" style={{ background: "rgba(255,255,255,0.08)", color: info.color }}>
            {info.badge}
          </span>
        </div>
      </div>

      {/* Persona cards */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 10 }}>
          Select friend personas participating in this outing:
        </div>
        <div className="grid-3" style={{ gap: 12 }}>
          {GROUP_PERSONAS.map((p, idx) => {
            const isSelected = selectedUserIds.includes(idx + 1);
            return (
              <div
                key={p.id}
                onClick={() => toggleUser(idx + 1)}
                style={{
                  padding: "14px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: isSelected ? "2px solid var(--coral-500)" : "1px solid var(--border-subtle)",
                  background: isSelected ? "var(--bg-surface-elevated)" : "transparent",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  position: "relative",
                }}
              >
                {isSelected && (
                  <div style={{ position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: "50%", background: "var(--coral-500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                    <Icons.Check size={11} />
                  </div>
                )}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: p.color,
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.3rem",
                    margin: "0 auto 8px",
                    boxShadow: isSelected ? "0 4px 12px rgba(224,94,58,0.25)" : "none",
                  }}
                >
                  {p.emoji}
                </div>
                <div style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: "0.95rem", marginBottom: 4 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  {p.prefs.join(" · ")}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--coral-400)", marginTop: 6, fontWeight: 500 }}>
                  Budget: {p.budget}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block btn-lg"
        onClick={run}
        disabled={finding || selectedUserIds.length === 0}
      >
        {finding ? "Aggregating multi-persona utility…" : `Calculate Consensus for ${selectedUserIds.length} Friends ↗`}
      </button>

      {finding && (
        <div className="skeleton-container fade-in" style={{ marginTop: 16 }}>
          <div className="skeleton-line" style={{ height: 60, width: "100%", borderRadius: 8 }} />
        </div>
      )}

      {/* Consensus Result Cards with Individual Satisfaction Bars */}
      {found && groupResults && groupResults.length > 0 && (
        <div className="fade-up" style={{ marginTop: 20 }}>
          <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: 12 }}>
            Top consensus recommendations based on <strong>{strategy.replace("_", " ")}</strong>:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {groupResults.slice(0, 3).map((item, idx) => (
              <div
                key={item.place.id || idx}
                className="card"
                style={{
                  padding: 18,
                  background: "var(--bg-surface-elevated)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="badge" style={{ background: "var(--coral-500)", color: "#fff", fontWeight: 700 }}>
                      #{idx + 1}
                    </span>
                    <strong style={{ fontSize: "1.15rem", color: "var(--text-primary)" }}>
                      {item.place.name}
                    </strong>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--coral-400)", fontWeight: 700, fontSize: "1.1rem" }}>
                    {Math.round(item.score * 100)}% match
                  </span>
                </div>

                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 14 }}>
                  <span style={{ textTransform: "capitalize" }}>{item.place.category}</span> · {item.distance_km} km away · {item.reasons.join(" · ")}
                </div>

                {/* Per-user satisfaction breakdown bars */}
                <div style={{ background: "var(--bg-surface)", padding: "12px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Individual Member Satisfaction
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Object.entries(item.user_scores).map(([uid, uScore]) => {
                      const persona = GROUP_PERSONAS[parseInt(uid, 10) - 1];
                      const name = persona?.name || `Friend ${uid}`;
                      const pct = Math.round(uScore * 100);
                      const isHigh = pct >= 80;
                      return (
                        <div key={uid} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.84rem" }}>
                          <span style={{ width: 64, color: "var(--text-primary)", fontWeight: 500 }}>{name}</span>
                          <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: isHigh ? "var(--teal-400)" : "var(--amber-400)",
                                borderRadius: 999,
                                transition: "width 0.6s ease",
                              }}
                            />
                          </div>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: isHigh ? "var(--teal-400)" : "var(--amber-400)", width: 38, textAlign: "right" }}>
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback Presentation when using simulated data */}
      {found && (!groupResults || groupResults.length === 0) && (
        <div className="fade-up" style={{ marginTop: 20 }}>
          <div
            className="card"
            style={{
              padding: 20,
              background: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="badge" style={{ background: "var(--coral-500)", color: "#fff", fontWeight: 700 }}>
                  Consensus Winner
                </span>
                <strong style={{ fontSize: "1.2rem", color: "var(--text-primary)" }}>
                  {GROUP_RESULT.name}
                </strong>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--coral-400)", fontWeight: 700, fontSize: "1.15rem" }}>
                {GROUP_RESULT.match}% match
              </span>
            </div>

            <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", margin: "0 0 16px" }}>
              {GROUP_RESULT.reason}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {GROUP_RESULT.stops.map((s) => (
                <div
                  key={s.time}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg-surface)",
                    fontSize: "0.88rem",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--coral-400)", fontWeight: 600, width: 75 }}>
                    {s.time}
                  </span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{s.place}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
