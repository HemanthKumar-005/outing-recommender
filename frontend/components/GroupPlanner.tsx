"use client";

import { useState } from "react";
import { GROUP_PERSONAS, GROUP_RESULT } from "../lib/demo-data";
import { fetchGroupRecommendations, type GroupRecommendation } from "../lib/api";

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
      // Attempt live consensus query against recommendation-engine
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
      // Degrade gracefully to simulated demo result
    } finally {
      setFinding(false);
    }

    // Fallback presentation
    setTimeout(() => {
      setFound(true);
    }, 400);
  };

  return (
    <div className="card">
      {/* Strategy selector pills */}
      <div style={{ marginBottom: 18, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "0.85rem", color: "var(--slate)" }}>Consensus Rule:</span>
        <div style={{ display: "inline-flex", gap: 6 }}>
          {[
            { id: "least_misery", label: "🛡️ Least Misery", desc: "Nobody hates it" },
            { id: "average", label: "⚖️ Average", desc: "Equal utilitarian weight" },
            { id: "borda", label: "🗳️ Borda Count", desc: "Ranked voting" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              className={`btn btn-sm ${strategy === s.id ? "btn-primary" : "btn-secondary"}`}
              style={{ fontSize: "0.8rem", padding: "4px 10px" }}
              onClick={() => setStrategy(s.id as any)}
              title={s.desc}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Persona cards */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {GROUP_PERSONAS.map((p, idx) => {
          const isSelected = selectedUserIds.includes(idx + 1);
          return (
            <div
              key={p.id}
              onClick={() => toggleUser(idx + 1)}
              style={{
                padding: 16,
                borderRadius: "var(--radius-sm)",
                border: isSelected ? "2px solid var(--brass, #d4af37)" : "1px solid var(--hairline)",
                background: isSelected ? "rgba(212, 175, 55, 0.06)" : "var(--ink-3)",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: p.color,
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.4rem",
                  margin: "0 auto 10px",
                }}
              >
                {p.emoji}
              </div>
              <div style={{ color: "#fff", fontWeight: 500, marginBottom: 6 }}>
                {p.name} {isSelected ? "✓" : ""}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--slate)" }}>
                {p.prefs.join(" · ")}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--brass)", marginTop: 6 }}>
                💰 {p.budget}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={run}
        disabled={finding || selectedUserIds.length === 0}
      >
        {finding ? "Finding group consensus outing…" : `Find outing for ${selectedUserIds.length} friends`}
      </button>

      {finding && (
        <p className="empty fade-in" style={{ marginTop: 16 }}>
          Aggregating multi-persona utility via <strong>{strategy.replace("_", " ")}</strong> consensus…
        </p>
      )}

      {found && groupResults && groupResults.length > 0 && (
        <div className="fade-up" style={{ marginTop: 16 }}>
          <div style={{ fontSize: "0.9rem", color: "var(--slate)", marginBottom: 12 }}>
            Top consensus recommendations based on <strong>{strategy.replace("_", " ")}</strong>:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {groupResults.slice(0, 3).map((item, idx) => (
              <div
                key={item.place.id || idx}
                style={{
                  padding: 16,
                  borderRadius: "var(--radius)",
                  background: "var(--paper)",
                  color: "var(--on-paper-ink)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>
                    #{idx + 1} {item.place.name}
                  </strong>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--brass-dim)", fontWeight: 600 }}>
                    {Math.round(item.score * 100)}% match
                  </span>
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--on-paper-muted)", margin: "4px 0 10px" }}>
                  {item.place.category} · {item.distance_km} km away · {item.reasons.join(" · ")}
                </div>
                {/* Per-user satisfaction pills */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {Object.entries(item.user_scores).map(([uid, uScore]) => {
                    const persona = GROUP_PERSONAS[parseInt(uid, 10) - 1];
                    const name = persona?.name || `Friend ${uid}`;
                    return (
                      <span
                        key={uid}
                        style={{
                          fontSize: "0.75rem",
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: uScore >= 0.7 ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
                          color: uScore >= 0.7 ? "#166534" : "#854d0e",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {name}: {Math.round(uScore * 100)}%
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {found && (!groupResults || groupResults.length === 0) && (
        <div className="fade-up" style={{ marginTop: 16 }}>
          <div
            style={{
              padding: 20,
              borderRadius: "var(--radius)",
              background: "var(--paper)",
              color: "var(--on-paper-ink)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <strong style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>
                {GROUP_RESULT.name}
              </strong>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--brass-dim)", fontWeight: 600 }}>
                {GROUP_RESULT.match}% match
              </span>
            </div>
            <p style={{ fontSize: "0.88rem", color: "var(--on-paper-muted)", margin: "0 0 14px" }}>
              {GROUP_RESULT.reason}
            </p>
            {GROUP_RESULT.stops.map((s) => (
              <div
                key={s.time}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "8px 0",
                  borderTop: "1px solid var(--hairline-paper)",
                  fontSize: "0.88rem",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--brass-dim)", width: 70 }}>
                  {s.time}
                </span>
                <span>{s.place}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
