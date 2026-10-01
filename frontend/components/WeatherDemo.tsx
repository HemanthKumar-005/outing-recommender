"use client";

import { useState } from "react";

export default function WeatherDemo() {
  const [rainy, setRainy] = useState(false);

  return (
    <div>
      <div className={`weather-scene ${rainy ? "rainy" : "sunny"}`}>
        <div className="weather-icon">{rainy ? "🌧️" : "☀️"}</div>
        <h3 style={{ marginBottom: 8 }}>
          {rainy ? "Rain expected — indoor alternative" : "Sunny afternoon — outdoor pick"}
        </h3>
        <p style={{ color: "var(--slate)", margin: "0 0 16px", maxWidth: 320 }}>
          {rainy
            ? "Cubbon Park walk swapped for National Gallery of Modern Art. Same vibe, dry shoes."
            : "Cubbon Park Walk — 2.4 km away, free entry, perfect for a group stroll."}
        </p>
        <div
          style={{
            background: "var(--paper)",
            color: "var(--on-paper-ink)",
            borderRadius: "var(--radius-sm)",
            padding: "14px 18px",
            width: "100%",
            maxWidth: 320,
            textAlign: "left",
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", marginBottom: 4 }}>
            {rainy ? "National Gallery of Modern Art" : "Cubbon Park Walk"}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--on-paper-muted)" }}>
            {rainy ? "museum · indoor · 4.0 km" : "park · outdoor · 2.4 km"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
        <button
          type="button"
          className={`chip ${!rainy ? "active" : ""}`}
          onClick={() => setRainy(false)}
        >
          ☀️ Sunny
        </button>
        <button
          type="button"
          className={`chip ${rainy ? "active" : ""}`}
          onClick={() => setRainy(true)}
        >
          🌧️ Rain
        </button>
      </div>
    </div>
  );
}
