"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

type DemoTravelMode = "driving" | "transit" | "cycling" | "walking";

interface Waypoint {
  id: string;
  name: string;
  category: string;
  area: string;
  score: number;
  rating: string;
  image: string;
  distanceKm: number;
  durations: Record<DemoTravelMode, string>;
  reasons: string[];
}

const WAYPOINTS: Waypoint[] = [
  {
    id: "stop1",
    name: "Truffles Bistro",
    category: "Burger Bistro & Shakes",
    area: "St. Mark's Road",
    score: 91,
    rating: "4.6",
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",
    distanceKm: 4.8,
    durations: {
      driving: "14 mins",
      transit: "28 mins",
      cycling: "20 mins",
      walking: "58 mins",
    },
    reasons: ["Top burger consensus", "Fast service", "Outdoor patio"],
  },
  {
    id: "stop2",
    name: "Cubbon Park",
    category: "Botanical Nature Trail",
    area: "Central Bengaluru",
    score: 97,
    rating: "4.7",
    image: "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=600&q=80",
    distanceKm: 6.2,
    durations: {
      driving: "18 mins",
      transit: "34 mins",
      cycling: "26 mins",
      walking: "76 mins",
    },
    reasons: ["Traffic-free walking loop", "300+ green acres", "Free entry"],
  },
  {
    id: "stop3",
    name: "Toit Brewpub",
    category: "Craft Microbrewery",
    area: "Indiranagar",
    score: 95,
    rating: "4.7",
    image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80",
    distanceKm: 10.4,
    durations: {
      driving: "28 mins",
      transit: "48 mins",
      cycling: "44 mins",
      walking: "128 mins",
    },
    reasons: ["Craft beer tasting paddle", "Lively group vibe", "Wood-fired pizzas"],
  },
];

const MODE_CONFIGS: Record<
  DemoTravelMode,
  { label: string; icon: string; strokeColor: string; speedTag: string; note: string }
> = {
  driving: {
    label: "Car",
    icon: "🚗",
    strokeColor: "#087F73",
    speedTag: "Road Network Speed",
    note: "Calculated via actual arterial corridors and road geometry.",
  },
  transit: {
    label: "Bus / Metro",
    icon: "🚌",
    strokeColor: "#ea580c",
    speedTag: "Public Transit",
    note: "Covers primary bus routes and metro connection interchanges.",
  },
  cycling: {
    label: "Bicycle",
    icon: "🚲",
    strokeColor: "#0284c7",
    speedTag: "Cycling Trail",
    note: "Paced at ~15 km/h along bike-friendly and secondary roads.",
  },
  walking: {
    label: "Walking",
    icon: "🚶",
    strokeColor: "#16a34a",
    speedTag: "Footpath Walkway",
    note: "Paced at ~4.5 km/h along pedestrian-safe sidewalks.",
  },
};

interface TravelRouteVisualizationProps {
  primaryHref: string;
}

export default function TravelRouteVisualization({ primaryHref }: TravelRouteVisualizationProps) {
  const [activeMode, setActiveMode] = useState<DemoTravelMode>("driving");
  const [selectedWaypoint, setSelectedWaypoint] = useState<number>(0);
  const [inView, setInView] = useState<boolean>(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect(); // trigger once
          }
        });
      },
      { threshold: 0.25 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const activeConfig = MODE_CONFIGS[activeMode];
  const activeSpot = WAYPOINTS[selectedWaypoint];

  return (
    <section
      ref={sectionRef}
      className={`route-vis-section ${inView ? "is-animated" : ""}`}
      id="travel-routes"
      aria-label="Animated Travel Route Visualization"
    >
      <div className="landing-container">
        {/* Section Header */}
        <div className="section-header-split" style={{ marginBottom: "40px" }}>
          <div>
            <p className="eyebrow">Real Road Routing</p>
            <h2 className="section-heading">
              Watch your journey <em>come alive.</em>
            </h2>
          </div>
          <p className="section-lead">
            Nearby replaces straight-line guesses with actual road network routing. Select your travel mode below to see dynamic road paths, times, and venue waypoints.
          </p>
        </div>

        {/* Interactive Travel Mode Controls */}
        <div className="route-vis-mode-bar">
          <div className="route-vis-mode-pills" role="radiogroup" aria-label="Select travel mode preview">
            {(Object.keys(MODE_CONFIGS) as DemoTravelMode[]).map((mode) => {
              const cfg = MODE_CONFIGS[mode];
              const isActive = activeMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  className={`route-mode-btn ${isActive ? "active" : ""}`}
                  onClick={() => setActiveMode(mode)}
                >
                  <span className="route-mode-icon">{cfg.icon}</span>
                  <span className="route-mode-label">{cfg.label}</span>
                </button>
              );
            })}
          </div>

          <div className="route-mode-note">
            <span className="route-mode-speed-tag">{activeConfig.speedTag}</span>
            <span className="route-mode-note-text">{activeConfig.note}</span>
          </div>
        </div>

        {/* Main Route Visualization Canvas */}
        <div className="route-canvas-shell">
          {/* Animated SVG Map Ground */}
          <div className="route-map-backdrop" aria-hidden="true">
            {/* Soft grid lines to mimic an architectural map */}
            <svg className="route-map-grid-svg" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="mapGridPattern" width="48" height="48" patternUnits="userSpaceOnUse">
                  <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(8, 127, 115, 0.06)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#mapGridPattern)" />
            </svg>

            {/* Dynamic Road Path SVG */}
            <svg
              className="route-path-svg"
              viewBox="0 0 960 440"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Outer Glow Path */}
              <path
                d="M 90 280 C 180 200, 260 220, 360 170 C 460 120, 560 260, 680 180 C 760 120, 830 150, 890 140"
                stroke={activeConfig.strokeColor}
                strokeWidth="10"
                strokeOpacity="0.18"
                strokeLinecap="round"
                className="route-svg-glow"
              />

              {/* Main Animated Highway Stroke */}
              <path
                d="M 90 280 C 180 200, 260 220, 360 170 C 460 120, 560 260, 680 180 C 760 120, 830 150, 890 140"
                stroke={activeConfig.strokeColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={activeMode === "transit" ? "8 8" : undefined}
                className="route-svg-main-path"
              />
            </svg>

            {/* Start Marker Pin (Koramangala) */}
            <div className="route-pin route-pin-start" style={{ left: "9%", top: "63%" }}>
              <span className="route-radar-pulse" />
              <div className="route-pin-bubble start-bubble">
                <span>🏠 Start: Koramangala 4th Block</span>
              </div>
            </div>

            {/* Stop 1 Pin (Truffles) */}
            <div
              className={`route-pin route-pin-stop stop-1 ${selectedWaypoint === 0 ? "selected" : ""}`}
              style={{ left: "37%", top: "38%" }}
              onClick={() => setSelectedWaypoint(0)}
            >
              <div className="route-pin-badge">
                <span>1</span>
              </div>
              <span className="route-pin-tag">Truffles · {WAYPOINTS[0].durations[activeMode]}</span>
            </div>

            {/* Stop 2 Pin (Cubbon Park) */}
            <div
              className={`route-pin route-pin-stop stop-2 ${selectedWaypoint === 1 ? "selected" : ""}`}
              style={{ left: "70%", top: "41%" }}
              onClick={() => setSelectedWaypoint(1)}
            >
              <div className="route-pin-badge">
                <span>2</span>
              </div>
              <span className="route-pin-tag">Cubbon Park · {WAYPOINTS[1].durations[activeMode]}</span>
            </div>

            {/* Stop 3 Pin (Toit Indiranagar) */}
            <div
              className={`route-pin route-pin-stop stop-3 ${selectedWaypoint === 2 ? "selected" : ""}`}
              style={{ left: "91%", top: "31%" }}
              onClick={() => setSelectedWaypoint(2)}
            >
              <div className="route-pin-badge">
                <span>3</span>
              </div>
              <span className="route-pin-tag">Toit · {WAYPOINTS[2].durations[activeMode]}</span>
            </div>
          </div>

          {/* Featured Waypoint Inspection Card */}
          <div className="route-waypoint-hud">
            <div className="route-hud-header">
              <span className="route-hud-eyebrow">DESTINATION STOP #{selectedWaypoint + 1}</span>
              <span className="route-hud-match">★ {activeSpot.score}% MATCH</span>
            </div>

            <div className="route-hud-body">
              <img
                src={activeSpot.image}
                alt={activeSpot.name}
                className="route-hud-thumb"
              />
              <div className="route-hud-info">
                <h4 className="route-hud-title">{activeSpot.name}</h4>
                <p className="route-hud-category">{activeSpot.category} · {activeSpot.area}</p>
                <div className="route-hud-metrics">
                  <span className="route-metric-pill">
                    📍 {activeSpot.distanceKm} km road distance
                  </span>
                  <span className="route-metric-pill highlight">
                    ⏱️ ~{activeSpot.durations[activeMode]} by {activeConfig.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="route-hud-chips">
              {activeSpot.reasons.map((r) => (
                <span key={r} className="route-reason-chip">
                  ✓ {r}
                </span>
              ))}
            </div>

            {/* Waypoint Switcher Buttons */}
            <div className="route-hud-switcher">
              {WAYPOINTS.map((wp, idx) => (
                <button
                  key={wp.id}
                  type="button"
                  className={`route-hud-switch-btn ${selectedWaypoint === idx ? "active" : ""}`}
                  onClick={() => setSelectedWaypoint(idx)}
                >
                  <span>Stop {idx + 1}: {wp.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CTA Banner linking to Planner */}
        <div className="route-vis-footer">
          <div className="route-footer-content">
            <strong>Ready to calculate road routes for your custom starting point?</strong>
            <span>Enter any pickup neighborhood in the Planner for instant OSRM routing.</span>
          </div>
          <Link href={primaryHref} className="btn-hero-primary" style={{ padding: "12px 22px", fontSize: "0.92rem", whiteSpace: "nowrap" }}>
            Open Route Planner →
          </Link>
        </div>
      </div>
    </section>
  );
}
