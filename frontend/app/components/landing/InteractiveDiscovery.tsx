"use client";

import { useState } from "react";
import Link from "next/link";
import { getPlaceImageUrl } from "../../utils/placeImages";

export type PreviewScenario = "friends" | "couple" | "family";

export type PreviewSpot = {
  name: string;
  category: string;
  score: number;
  meta: string;
  travel: string;
  price: string;
  reasons: string[];
  bookingUrl?: string;
  verified: boolean;
};

export const SCENARIOS: Record<
  PreviewScenario,
  { label: string; icon: string; tag: string; context: string; weather: string; spots: PreviewSpot[] }
> = {
  friends: {
    label: "Friends Night Out",
    icon: "👥",
    tag: "Social & Lively",
    context: "Starting from Koramangala → Exploring Indiranagar",
    weather: "🌤️ Friday Evening · 22°C Clear",
    spots: [
      {
        name: "Toit Brewpub",
        category: "Craft Brewery",
        score: 95,
        meta: "Indiranagar · ★ 4.7 / 5 (620 reviews)",
        travel: "📍 5.2 km · ~16 mins by car",
        price: "₹800 – ₹1,400 per person · $$$",
        reasons: ["Top consensus for groups", "Open until 1 AM", "Lively craft taproom"],
        bookingUrl: "https://toit.in/indiranagar-reservations",
        verified: true,
      },
      {
        name: "Truffles",
        category: "Burger Bistro",
        score: 91,
        meta: "St. Mark's Road · ★ 4.6 / 5 (850 reviews)",
        travel: "📍 4.8 km · ~14 mins by car",
        price: "₹350 – ₹600 per person · $$",
        reasons: ["Budget-friendly favorites", "Short walk from metro", "Great burgers & desserts"],
        bookingUrl: "https://www.zomato.com/bangalore/truffles-st-marks-road/book",
        verified: true,
      },
      {
        name: "Third Wave Coffee",
        category: "Specialty Cafe",
        score: 87,
        meta: "Koramangala 4th Block · ★ 4.6 / 5",
        travel: "📍 1.1 km · ~4 mins driving",
        price: "₹250 – ₹450 per person · $$",
        reasons: ["Outdoor seating", "Late-night coffee & dessert", "Cozy group seating"],
        verified: true,
      },
    ],
  },
  couple: {
    label: "Romantic Date Night",
    icon: "🕯️",
    tag: "Intimate & Fine Dining",
    context: "Starting from Jayanagar → Exploring Whitefield",
    weather: "🌙 Saturday Evening · 21°C Mild Breeze",
    spots: [
      {
        name: "Windmills Craftworks",
        category: "Jazz Lounge & Dining",
        score: 96,
        meta: "Whitefield · ★ 4.8 / 5",
        travel: "📍 18.2 km · ~42 mins by car",
        price: "₹1,800+ per person · $$$$",
        reasons: ["Intimate acoustic setting", "Craft microbrewery", "Fine dining menu"],
        bookingUrl: "https://craftworks.windmills.in/reserve",
        verified: true,
      },
      {
        name: "National Gallery of Modern Art",
        category: "Heritage Museum & Garden",
        score: 90,
        meta: "Palace Road · ★ 4.6 / 5",
        travel: "📍 6.8 km · ~20 mins by car",
        price: "₹50 entry fee · $",
        reasons: ["Serene courtyard cafe", "Beautiful sculpture gardens", "Calm afternoon pace"],
        verified: true,
      },
      {
        name: "Blue Tokai Coffee Roasters",
        category: "Artisan Cafe",
        score: 86,
        meta: "Indiranagar · ★ 4.5 / 5",
        travel: "📍 8.4 km · ~24 mins by car",
        price: "₹300 – ₹550 per person · $$",
        reasons: ["Artisan sourdough & pastries", "Warm ambient lighting", "Open now"],
        verified: true,
      },
    ],
  },
  family: {
    label: "Weekend Family Outing",
    icon: "🌿",
    tag: "All-Ages Friendly",
    context: "Starting from Electronic City → Exploring Central BLR",
    weather: "☀️ Sunday Morning · Sunny 24°C",
    spots: [
      {
        name: "Cubbon Park",
        category: "Botanical Park",
        score: 97,
        meta: "Central Bengaluru · ★ 4.7 / 5",
        travel: "📍 16.5 km · ~35 mins by car",
        price: "Free Entry",
        reasons: ["Sunny morning lawns", "Traffic-free walking trails", "Kid-friendly play areas"],
        verified: true,
      },
      {
        name: "Visvesvaraya Industrial & Tech Museum",
        category: "Science Museum",
        score: 93,
        meta: "Kasturba Road · ★ 4.6 / 5",
        travel: "📍 16.8 km · ~36 mins by car",
        price: "₹85 per person · $",
        reasons: ["Hands-on interactive exhibits", "Fun for kids & adults", "Air-conditioned indoor spot"],
        verified: true,
      },
      {
        name: "Mavalli Tiffin Room (MTR)",
        category: "Heritage Restaurant",
        score: 91,
        meta: "Lalbagh Road · ★ 4.5 / 5",
        travel: "📍 15.1 km · ~32 mins by car",
        price: "₹200 – ₹400 per person · $$",
        reasons: ["Iconic South Indian breakfast", "Pure vegetarian", "Decades of trusted quality"],
        verified: true,
      },
    ],
  },
};

interface InteractiveDiscoveryProps {
  primaryHref: string;
}

export default function InteractiveDiscovery({ primaryHref }: InteractiveDiscoveryProps) {
  const [scenario, setScenario] = useState<PreviewScenario>("friends");
  const currentScenario = SCENARIOS[scenario];

  return (
    <section id="preview" className="landing-section" aria-label="Interactive Destination Discovery">
      <div className="landing-container">
        {/* Section Header */}
        <div className="section-header-split">
          <div>
            <p className="eyebrow">Interactive Discovery</p>
            <h2 className="section-heading">
              Tailored for <em>whoever you&apos;re with.</em>
            </h2>
          </div>
          <p className="section-lead">
            Select an outing mode below to see how recommendations dynamically adapt with verified photos, live road durations, match scores, and table reservations.
          </p>
        </div>

        {/* Discovery Shell */}
        <div className="discovery-shell">
          {/* Mode Switcher Sidebar */}
          <div className="discovery-sidebar">
            <div className="discovery-sidebar-top">
              <span className="eyebrow" style={{ marginBottom: "12px", display: "block" }}>
                Select Outing Vibe
              </span>
              <div className="discovery-tab-list" role="tablist" aria-label="Outing scenarios">
                {(Object.keys(SCENARIOS) as PreviewScenario[]).map((key) => {
                  const s = SCENARIOS[key];
                  const isActive = scenario === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`discovery-tab-btn ${isActive ? "active" : ""}`}
                      onClick={() => setScenario(key)}
                    >
                      <div className="discovery-tab-icon">{s.icon}</div>
                      <div className="discovery-tab-text">
                        <span className="discovery-tab-title">{s.label}</span>
                        <span className="discovery-tab-tag">{s.tag}</span>
                      </div>
                      <span className="discovery-tab-arrow" aria-hidden="true">→</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="discovery-sidebar-footer">
              <p className="discovery-sidebar-tip">
                Every venue card is cross-checked against current day-of-week operating hours, weather, and real road networks.
              </p>
              <Link href={primaryHref} className="btn-hero-primary" style={{ width: "100%", justifyContent: "center", padding: "12px 18px", fontSize: "0.92rem" }}>
                Plan This Outing →
              </Link>
            </div>
          </div>

          {/* Cards Stage */}
          <div className="discovery-cards-stage">
            {/* Live Scenario Context Pill */}
            <div className="discovery-context-banner">
              <div className="discovery-context-route">
                <span>📍 {currentScenario.context}</span>
              </div>
              <div className="discovery-context-weather">
                <span>{currentScenario.weather}</span>
              </div>
            </div>

            {/* Staggered Recommendations List */}
            <div key={scenario} className="discovery-cards-grid stagger-children is-visible">
              {currentScenario.spots.map((spot, idx) => {
                const img = getPlaceImageUrl(spot.name, spot.category);
                return (
                  <article
                    key={spot.name}
                    className="discovery-ticket-card anim-card"
                    style={{ "--i": idx } as React.CSSProperties}
                  >
                    {/* Visual Banner */}
                    <div className="discovery-ticket-thumb-wrap">
                      <img
                        src={img}
                        alt={spot.name}
                        className="discovery-ticket-thumb"
                        loading="lazy"
                      />
                      <span className="discovery-score-badge">
                        ★ {spot.score}% Match
                      </span>
                    </div>

                    {/* Content Details */}
                    <div className="discovery-ticket-body">
                      <div className="discovery-ticket-header">
                        <div>
                          <h4 className="discovery-ticket-title">{spot.name}</h4>
                          <p className="discovery-ticket-meta">{spot.category} · {spot.meta}</p>
                        </div>
                        {spot.verified && (
                          <span className="discovery-verified-pill">
                            ✓ Hours verified
                          </span>
                        )}
                      </div>

                      <div className="discovery-ticket-travel-price">
                        <span className="discovery-travel-pill">{spot.travel}</span>
                        <span className="discovery-price-pill">{spot.price}</span>
                      </div>

                      <div className="discovery-reason-chips">
                        {spot.reasons.map((r) => (
                          <span key={r} className="discovery-reason-chip">
                            {r}
                          </span>
                        ))}
                      </div>

                      <div className="discovery-ticket-actions">
                        {spot.bookingUrl ? (
                          <a
                            href={spot.bookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="discovery-reserve-btn"
                          >
                            Reserve Table / Spot →
                          </a>
                        ) : (
                          <span className="discovery-walkin-pill">Walk-ins welcome</span>
                        )}
                        <Link href={primaryHref} className="discovery-plan-link">
                          Add to Itinerary
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
