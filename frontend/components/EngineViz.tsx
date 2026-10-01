"use client";

import { useState, useEffect } from "react";
import { ENGINE_FACTORS } from "../lib/demo-data";

export default function EngineViz() {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="card">
      <p className="eyebrow">Recommendation engine</p>
      <h3 style={{ marginBottom: 20 }}>How a match score is built</h3>
      {ENGINE_FACTORS.map((f) => (
        <div className="factor-bar" key={f.id}>
          <span className="factor-label">{f.label}</span>
          <div className="factor-track">
            <div
              className="factor-fill"
              style={{ width: animated ? `${f.weight * 4}%` : "0%" }}
            />
          </div>
          <span className="factor-value">{f.weight}%</span>
        </div>
      ))}
      <div
        style={{
          marginTop: 24,
          padding: "16px 18px",
          background: "var(--ink-3)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--hairline)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: "var(--slate)", fontSize: "0.9rem" }}>
          Preferences → Context → Reviews → Distance → Group → Score
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "1.4rem",
            color: "var(--brass-bright)",
            fontWeight: 600,
          }}
        >
          92
        </span>
      </div>
    </div>
  );
}
