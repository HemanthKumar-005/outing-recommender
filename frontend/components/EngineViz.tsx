"use client";

import { useState, useEffect } from "react";
import { ENGINE_FACTORS } from "../lib/demo-data";
import { Icons } from "./Icons";

const FACTOR_COLORS = [
  { color: "var(--coral-400)", bg: "var(--coral-500)", detail: "Category preference vector & past outing interactions" },
  { color: "var(--amber-400)", bg: "var(--amber-500)", detail: "Real-time weather forecast, time of day & day of week" },
  { color: "var(--teal-400)", bg: "var(--teal-500)", detail: "Walking and driving distance from your selected location" },
  { color: "var(--violet-400)", bg: "var(--violet-500)", detail: "Least-misery / Borda consensus across all group members" },
  { color: "var(--rose-400)", bg: "var(--rose-500)", detail: "Anti-filter-bubble exploration slider & serendipity score" },
];

export default function EngineViz() {
  const [animated, setAnimated] = useState(false);
  const [selectedFactor, setSelectedFactor] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="card" style={{ position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <p className="eyebrow" style={{ color: "var(--coral-400)" }}>Hybrid Ranking Pipeline</p>
          <h3 style={{ margin: "4px 0 0", fontSize: "1.3rem" }}>How a match score is built</h3>
        </div>
        <span className="badge" style={{ background: "rgba(224, 94, 58, 0.15)", color: "var(--coral-400)" }}>
          <Icons.Sparkles size={12} style={{ marginRight: 4 }} /> Explainable ML
        </span>
      </div>

      <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginBottom: 20 }}>
        Every recommendation combines personalized signals with environmental context. Click any factor to inspect its input:
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {ENGINE_FACTORS.map((f, i) => {
          const cfg = FACTOR_COLORS[i % FACTOR_COLORS.length];
          const isSelected = selectedFactor === i;
          return (
            <div
              key={f.id}
              onClick={() => setSelectedFactor(isSelected ? null : i)}
              style={{
                cursor: "pointer",
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                background: isSelected ? "var(--bg-surface-elevated)" : "transparent",
                transition: "background var(--duration-fast) var(--ease-out)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.88rem" }}>
                <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{f.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: cfg.color }}>{f.weight}%</span>
              </div>
              <div className="factor-track" style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 999 }}>
                <div
                  className="factor-fill"
                  style={{
                    width: animated ? `${f.weight * 2.5}%` : "0%",
                    background: cfg.bg,
                    borderRadius: 999,
                    transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                />
              </div>
              {isSelected && (
                <div className="fade-in" style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 6, paddingLeft: 2 }}>
                  ↳ <em>{cfg.detail}</em>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 22,
          padding: "14px 18px",
          background: "var(--bg-surface-elevated)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.84rem", color: "var(--text-secondary)" }}>
          <Icons.ShieldCheck size={16} style={{ color: "var(--teal-400)" }} />
          <span>No opaque black box — weights are transparent and user-tunable.</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Composite Match</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.35rem", color: "var(--coral-400)", fontWeight: 700 }}>94%</div>
        </div>
      </div>
    </div>
  );
}
