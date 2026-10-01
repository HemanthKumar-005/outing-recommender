"use client";

import { useState } from "react";
import { GROUP_PERSONAS, GROUP_RESULT } from "../lib/demo-data";

export default function GroupPlanner() {
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState(false);

  const run = () => {
    setFinding(true);
    setFound(false);
    setTimeout(() => {
      setFinding(false);
      setFound(true);
    }, 1400);
  };

  return (
    <div className="card">
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {GROUP_PERSONAS.map((p) => (
          <div
            key={p.id}
            style={{
              padding: 16,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--hairline)",
              background: "var(--ink-3)",
              textAlign: "center",
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
            <div style={{ color: "#fff", fontWeight: 500, marginBottom: 6 }}>{p.name}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--slate)" }}>
              {p.prefs.join(" · ")}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--brass)", marginTop: 6 }}>
              💰 {p.budget}
            </div>
          </div>
        ))}
      </div>

      {!found && (
        <button type="button" className="btn btn-primary btn-block" onClick={run} disabled={finding}>
          {finding ? "Finding something everyone likes…" : "Find group outing"}
        </button>
      )}

      {finding && (
        <p className="empty fade-in" style={{ marginTop: 16 }}>
          Balancing café, entertainment, and outdoor preferences…
        </p>
      )}

      {found && (
        <div className="fade-up" style={{ marginTop: 8 }}>
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
