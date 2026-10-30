"use client";

import { useState } from "react";
import { Icons } from "./Icons";

export default function WeatherDemo() {
  const [rainy, setRainy] = useState(false);

  return (
    <div className="card" style={{ maxWidth: 440, margin: "0 auto", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span className="eyebrow" style={{ color: rainy ? "var(--teal-400)" : "var(--amber-400)" }}>
          {rainy ? "Live Weather: Rain Swapped" : "Live Weather: Clear Skies"}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className={`chip ${!rainy ? "active" : ""}`}
            onClick={() => setRainy(false)}
            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
          >
            <Icons.Sun size={13} style={{ marginRight: 4 }} /> Sunny
          </button>
          <button
            type="button"
            className={`chip ${rainy ? "active" : ""}`}
            onClick={() => setRainy(true)}
            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
          >
            <Icons.CloudRain size={13} style={{ marginRight: 4 }} /> Rain
          </button>
        </div>
      </div>

      <div
        className="fade-in"
        key={rainy ? "rainy" : "sunny"}
        style={{
          padding: "16px 18px",
          borderRadius: "var(--radius)",
          background: rainy ? "rgba(20, 184, 166, 0.08)" : "rgba(245, 158, 11, 0.08)",
          border: `1px solid ${rainy ? "rgba(20, 184, 166, 0.25)" : "rgba(245, 158, 11, 0.25)"}`,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: rainy ? "rgba(20, 184, 166, 0.15)" : "rgba(245, 158, 11, 0.15)",
              color: rainy ? "var(--teal-400)" : "var(--amber-400)",
            }}
          >
            {rainy ? <Icons.CloudRain size={20} /> : <Icons.Sun size={20} />}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>
              {rainy ? "Rain forecast at 7:30 PM (80% prob)" : "Sunny afternoon (28°C · Gentle breeze)"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {rainy ? "Outdoor venues automatically swapped for dry indoor matches." : "Ideal conditions for walking paths & open-air cafes."}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-sm)",
            padding: "14px 16px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: "1.05rem", color: "var(--text-primary)" }}>
              {rainy ? "National Gallery of Modern Art" : "Cubbon Park Bamboo Grove"}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "2px 8px",
                borderRadius: 999,
                fontWeight: 600,
                textTransform: "uppercase",
                background: rainy ? "var(--cat-culture-bg)" : "var(--cat-outdoors-bg)",
                color: rainy ? "var(--cat-culture)" : "var(--cat-outdoors)",
              }}
            >
              {rainy ? "Indoor Culture" : "Outdoors"}
            </span>
          </div>
          <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)", margin: 0 }}>
            {rainy
              ? "Swapped from park stroll: dry sculpture hall, covered cafe, same serene group vibe."
              : "Shaded green paths, pet friendly, free entry, 1.8 km from your starting pin."}
          </p>
        </div>
      </div>

      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
        ⚡ Automatic fallback prevents wet shoes without having to restart planning.
      </div>
    </div>
  );
}
