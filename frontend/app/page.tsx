"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPlaceImageUrl } from "./utils/placeImages";

type PreviewScenario = "friends" | "couple" | "family";

type PreviewSpot = {
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

const SCENARIOS: Record<
  PreviewScenario,
  { label: string; context: string; spots: PreviewSpot[] }
> = {
  friends: {
    label: "Friends Night Out",
    context: "Starting from Koramangala → Exploring Indiranagar · Friday Evening · 22°C Clear",
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
    context: "Starting from Jayanagar → Exploring Whitefield · Saturday Evening · 21°C Mild Breeze",
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
    context: "Starting from Electronic City → Exploring Central BLR · Sunday Morning · Sunny 24°C",
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

const BUDGET_TIERS = [
  {
    title: "Pocket-Friendly Outings",
    range: "₹150 – ₹350 per person",
    badge: "$ · Budget",
    desc: "Scenic parks, heritage street cafes, iconic breakfast joints, and free botanical gardens.",
    examples: ["Cubbon Park", "Lalbagh Botanical Garden", "MTR Heritage Breakfast"],
  },
  {
    title: "Casual Dining & Bistros",
    range: "₹400 – ₹750 per person",
    badge: "$$ · Popular",
    desc: "Artisan coffee roasteries, top burger bistros, outdoor garden dining, and cultural museums.",
    examples: ["Truffles Bistro", "Third Wave Coffee", "Visvesvaraya Tech Museum"],
  },
  {
    title: "Craft Breweries & Lounges",
    range: "₹800 – ₹1,500 per person",
    badge: "$$$ · Nightlife",
    desc: "Famous microbreweries, rooftop cocktail lounges, and lively live-music taprooms.",
    examples: ["Toit Brewpub", "Arbor Brewing Company", "The Biere Club"],
  },
  {
    title: "Special Occasions & Fine Dining",
    range: "₹1,800+ per person",
    badge: "$$$$ · Premium",
    desc: "Acoustic jazz clubs, luxury heritage dining, and unforgettable date night spots.",
    examples: ["Windmills Craftworks", "Olive Beach", "Grasshopper"],
  },
];

const FAQS = [
  {
    q: "How does Nearby calculate travel time and distance?",
    a: "When you enter your starting point and destination, Nearby uses actual road routing to calculate real driving, walking, or cycling times to each venue, so you know exactly how long the trip will take.",
  },
  {
    q: "Can I plan an outing with friends who have different tastes?",
    a: "Yes! Nearby includes a smart group mode that balances everyone's preferences, budget, and favorite categories so no one gets stuck at a place they dislike.",
  },
  {
    q: "Do I have to share my GPS or coordinates?",
    a: "No. You never need to share device location or understand geographic coordinates. Simply search any city, neighborhood, landmark, or street address.",
  },
  {
    q: "Can I book a table or get turn-by-turn directions?",
    a: "Yes! Every place card features an interactive map button, a one-click Google Maps turn-by-turn directions link from your starting point, and direct table booking where supported.",
  },
  {
    q: "Is Nearby free to use?",
    a: "Yes, Nearby is completely free for exploring places and planning trips. You only pay for what you purchase or book directly at the venue.",
  },
];

export default function LandingPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [scenario, setScenario] = useState<PreviewScenario>("friends");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setAuthenticated(Boolean(d?.authenticated)))
      .catch(() => setAuthenticated(false));
  }, []);

  const primaryHref = authenticated ? "/planner" : "/login";
  const currentScenario = SCENARIOS[scenario];

  return (
    <div className="landing">
      {/* Top Navigation */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link href="/" className="landing-brand">
            <span className="landing-brand-mark">N</span>
            <span>Nearby &amp; Co.</span>
          </Link>

          <nav className="landing-links" aria-label="Primary">
            <a href="#how-it-works">How It Works</a>
            <a href="#preview">Discover Places</a>
            <a href="#budget">Budget Matching</a>
            <a href="#travel">Travel-Smart</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className="landing-nav-actions">
            {authenticated ? (
              <Link href="/planner" className="nav-cta">
                Open Planner →
              </Link>
            ) : (
              <>
                <Link href="/login" className="nav-ghost">
                  Sign in
                </Link>
                <Link href="/login" className="nav-cta">
                  Plan Your Outing
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 1. Hero Section */}
      <section className="landing-hero">
        <div className="landing-container landing-hero-grid">
          <div>
            <p className="eyebrow">Smart Outing Discovery</p>
            <h1 className="landing-hero-title">
              Find the Perfect Place <br />
              <em>for Your Next Outing.</em>
            </h1>
            <p className="landing-hero-sub">
              Planning an outing with friends, family, or your partner? Tell us where you&apos;re starting from, where you&apos;d like to explore, and what you enjoy. We&apos;ll help you discover places that match your preferences.
            </p>
            <div className="landing-hero-actions">
              <Link href={primaryHref} className="btn-hero-primary" style={{ fontSize: "1.05rem", padding: "13px 26px" }}>
                Plan Your Outing →
              </Link>
              <a href="#how-it-works" className="btn-hero-secondary">
                See How It Works
              </a>
            </div>
            <div className="hero-meta-note">
              <span>✓ Real road distance &amp; travel times</span>
              <span>✓ Interactive maps &amp; turn-by-turn routes</span>
              <span>✓ Direct table booking</span>
            </div>
          </div>

          {/* Hero Visual Card */}
          <div className="hero-visual" aria-hidden="true">
            <div className="hero-card-back">
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--on-paper-muted)" }}>
                <span>Cubbon Park · Outdoors</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 600 }}>97% Match</span>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.1rem", marginTop: 4 }}>
                Morning Nature Walk
              </div>
            </div>

            <div className="hero-card-main">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="eyebrow" style={{ margin: 0 }}>Top Evening Pick</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    background: "var(--surface-soft)",
                    color: "var(--accent)",
                    padding: "4px 10px",
                    borderRadius: 999,
                  }}
                >
                  95% Match
                </span>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "1.7rem", fontWeight: 500, color: "var(--on-paper-ink)" }}>
                Toit Brewpub
              </div>
              <p style={{ margin: "4px 0 10px", fontSize: "0.86rem", color: "var(--on-paper-muted)" }}>
                Indiranagar · Craft Brewery · ★ 4.7 / 5
              </p>
              <div style={{ fontSize: "0.8rem", color: "var(--on-paper-ink)", background: "var(--surface-soft)", padding: "6px 10px", borderRadius: "6px", marginBottom: "12px", display: "inline-block" }}>
                📍 5.2 km from Koramangala · ~16 mins driving
              </div>
              <div className="reasons" style={{ marginBottom: 14 }}>
                <span className="reason-chip">Loved by groups</span>
                <span className="reason-chip">Open until 1 AM</span>
                <span className="reason-chip">Clear 22°C evening</span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span className="btn-secondary" style={{ marginTop: 0 }}>
                  Reserve table →
                </span>
                <span className="btn-tiny">🧭 View route</span>
              </div>
            </div>

            <div className="hero-card-badge-float">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Travel-Smart
              </div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, marginTop: 4 }}>
                🗺️ Live road routes &amp; travel times
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How It Works Section */}
      <section id="how-it-works" className="landing-section landing-section-soft">
        <div className="landing-container">
          <div className="section-header-split">
            <div>
              <p className="eyebrow">Guided Workflow</p>
              <h2 className="section-heading">
                How It <em>Works.</em>
              </h2>
            </div>
            <p className="section-lead">
              From deciding where to go to reaching your table — planned in four effortless steps.
            </p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-num">Step 01</div>
              <h3 className="step-title">Where to Explore</h3>
              <p className="step-desc">
                Select your target city or area — like Bengaluru, Mysuru, Indiranagar, or Cubbon Park.
              </p>
            </div>
            <div className="step-card">
              <div className="step-num">Step 02</div>
              <h3 className="step-title">Starting Location</h3>
              <p className="step-desc">
                Enter where you are starting from so we can calculate exact driving, walking, and transit times.
              </p>
            </div>
            <div className="step-card">
              <div className="step-num">Step 03</div>
              <h3 className="step-title">Choose Your Vibe</h3>
              <p className="step-desc">
                Tell us who you&apos;re with — friends, family, date, or solo — and your preferred categories and radius.
              </p>
            </div>
            <div className="step-card">
              <div className="step-num">Step 04</div>
              <h3 className="step-title">Discover, Navigate &amp; Book</h3>
              <p className="step-desc">
                Explore cards with photographs, interactive maps, live operating hours, and instant reservations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Discover Places (Interactive Preview) */}
      <section id="preview" className="landing-section">
        <div className="landing-container">
          <div className="section-header-split">
            <div>
              <p className="eyebrow">Discover Places</p>
              <h2 className="section-heading">
                Tailored for <em>whoever you&apos;re with.</em>
              </h2>
            </div>
            <p className="section-lead">
              Click the modes below to see how recommendations adapt with real photos, ratings, travel times, and directions.
            </p>
          </div>

          <div className="preview-shell">
            <div className="preview-sidebar">
              <div>
                <div className="eyebrow" style={{ marginBottom: 10 }}>Select Outing Mode</div>
                <div className="preview-pill-group">
                  {(Object.keys(SCENARIOS) as PreviewScenario[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`preview-pill-btn ${scenario === key ? "active" : ""}`}
                      onClick={() => setScenario(key)}
                    >
                      <span>{SCENARIOS[key].label}</span>
                      <span>→</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: "1px dashed var(--hairline-paper)", paddingTop: 14 }}>
                <div style={{ fontSize: "0.82rem", color: "var(--on-paper-muted)", lineHeight: 1.55 }}>
                  Every place card includes high-resolution photos, verified hours, travel times, and table booking.
                </div>
                <Link
                  href={primaryHref}
                  className="btn-hero-primary"
                  style={{ marginTop: 14, width: "100%", justifyContent: "center", padding: "11px 16px", fontSize: "0.9rem" }}
                >
                  Plan Your Outing Now →
                </Link>
              </div>
            </div>

            <div>
              <div className="context-line" style={{ marginBottom: 14, fontWeight: 500 }}>
                {currentScenario.context}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {currentScenario.spots.map((spot) => {
                  const img = getPlaceImageUrl(spot.name, spot.category);
                  return (
                    <div
                      className="ticket"
                      key={spot.name}
                      style={{ gridTemplateColumns: "110px 1fr" }}
                    >
                      <div
                        style={{
                          backgroundImage: `url('${img}')`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          position: "relative",
                        }}
                      >
                        <span
                          style={{
                            position: "absolute",
                            bottom: 8,
                            left: 8,
                            background: "rgba(15, 118, 110, 0.92)",
                            color: "#fff",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {spot.score}%
                        </span>
                      </div>
                      <div className="ticket-main">
                        <div className="ticket-header">
                          <span className="ticket-name">{spot.name}</span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--accent)", fontWeight: 600 }}>
                            ✓ Hours verified
                          </span>
                        </div>
                        <div className="ticket-meta" style={{ margin: "2px 0 6px 0" }}>
                          {spot.category} · {spot.meta}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--on-paper-ink)", fontWeight: 600, marginBottom: "8px" }}>
                          {spot.travel} · <span style={{ color: "var(--on-paper-muted)", fontWeight: "normal" }}>{spot.price}</span>
                        </div>
                        <div className="reasons" style={{ marginBottom: spot.bookingUrl ? 10 : 0 }}>
                          {spot.reasons.map((r) => (
                            <span className="reason-chip" key={r}>
                              {r}
                            </span>
                          ))}
                        </div>
                        {spot.bookingUrl && (
                          <Link
                            href={primaryHref}
                            className="btn-secondary"
                            style={{ display: "inline-block", fontSize: "0.82rem", textDecoration: "none" }}
                          >
                            Reserve a spot →
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Find Places That Match Your Budget */}
      <section id="budget" className="landing-section landing-section-soft">
        <div className="landing-container">
          <div className="section-header-split">
            <div>
              <p className="eyebrow">Clear Pricing</p>
              <h2 className="section-heading">
                Find Places That Match <em>Your Budget.</em>
              </h2>
            </div>
            <p className="section-lead">
              Clear price indicators for every recommendation — from free nature walks to luxury weekend dining.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
            {BUDGET_TIERS.map((tier) => (
              <div
                key={tier.title}
                className="card"
                style={{ padding: "24px 22px", margin: 0, display: "flex", flexDirection: "column" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span className="eyebrow" style={{ margin: 0 }}>{tier.badge}</span>
                </div>
                <h3 style={{ margin: "4px 0", fontSize: "1.2rem", color: "var(--on-paper-ink)" }}>
                  {tier.title}
                </h3>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--accent)", marginBottom: 10 }}>
                  {tier.range}
                </div>
                <p style={{ fontSize: "0.85rem", color: "var(--on-paper-muted)", lineHeight: 1.5, margin: "0 0 14px 0" }}>
                  {tier.desc}
                </p>
                <div style={{ marginTop: "auto", borderTop: "1px dashed var(--hairline-paper)", paddingTop: "10px" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--on-paper-muted)", textTransform: "uppercase" }}>
                    Popular examples:
                  </span>
                  <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--on-paper-ink)", marginTop: "4px" }}>
                    {tier.examples.join(" · ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Travel-Smart Discovery Section */}
      <section id="travel" className="landing-section">
        <div className="landing-container">
          <div className="section-header-split">
            <div>
              <p className="eyebrow">Travel-Smart</p>
              <h2 className="section-heading">
                Explore Nearby <em>with Confidence.</em>
              </h2>
            </div>
            <p className="section-lead">
              Calculations based on actual road routing, real operating hours, and live weather conditions.
            </p>
          </div>

          <div className="bento-grid">
            <div className="bento-card">
              <div className="bento-kicker">Accurate Routing</div>
              <h3 className="bento-title">Real Road Distances</h3>
              <p className="bento-desc">
                We calculate genuine driving, walking, and cycling times from your exact starting neighborhood, not just straight-line distance.
              </p>
            </div>

            <div className="bento-card">
              <div className="bento-kicker">Interactive Maps</div>
              <h3 className="bento-title">Full Map Integration</h3>
              <p className="bento-desc">
                Explore recommended venues on an interactive map, view pin popups, and launch Google Maps turn-by-turn navigation in one tap.
              </p>
            </div>

            <div className="bento-card">
              <div className="bento-kicker">Weather-Smart</div>
              <h3 className="bento-title">Live Weather Matching</h3>
              <p className="bento-desc">
                Sunny afternoon? We suggest open-air gardens and rooftop bistros. Rainy evening? Cozy indoor lounges and museums.
              </p>
            </div>

            <div className="bento-card wide">
              <div className="bento-kicker">Group Harmony</div>
              <h3 className="bento-title">Fair for Every Group Member</h3>
              <p className="bento-desc">
                Planning with four friends? Our group balancer finds places that satisfy everyone&apos;s tastes and budgets, so no one feels left out.
              </p>
              <div className="signal-bar-row">
                <span>Vibe &amp; Category Match</span>
                <div className="signal-track"><div className="signal-fill" style={{ width: "95%" }} /></div>
                <span>95%</span>
              </div>
              <div className="signal-bar-row">
                <span>Distance &amp; Travel Convenience</span>
                <div className="signal-track"><div className="signal-fill" style={{ width: "92%" }} /></div>
                <span>92%</span>
              </div>
              <div className="signal-bar-row">
                <span>Weather &amp; Timing Fit</span>
                <div className="signal-track"><div className="signal-fill" style={{ width: "88%" }} /></div>
                <span>88%</span>
              </div>
            </div>

            <div className="bento-card">
              <div className="bento-kicker">No Closed Doors</div>
              <h3 className="bento-title">Verified Operating Hours</h3>
              <p className="bento-desc">
                Every venue is cross-checked against current day-of-week hours so you never encounter locked doors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section id="faq" className="landing-section landing-section-soft">
        <div className="landing-container faq-grid">
          <div>
            <p className="eyebrow">Frequently Asked Questions</p>
            <h2 className="section-heading">
              Got <em>questions?</em>
            </h2>
            <p className="section-lead" style={{ marginTop: 12 }}>
              Everything you need to know about planning your next outing with Nearby &amp; Co.
            </p>
          </div>

          <div>
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div className="faq-item" key={item.q}>
                  <button
                    type="button"
                    className="faq-trigger"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                  >
                    <span>{item.q}</span>
                    <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen && <p className="faq-answer">{item.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Closing Call to Action Banner */}
      <section className="closing-band">
        <div className="landing-container">
          <p className="eyebrow">Ready for your next adventure?</p>
          <h2 className="section-heading" style={{ fontSize: "clamp(2rem, 3.8vw, 3rem)" }}>
            Make the plan. <em>Not the debate.</em>
          </h2>
          <p className="section-lead" style={{ margin: "14px auto 28px", maxWidth: "48ch" }}>
            Enter your starting point, choose your destination, and discover great places with real travel times in seconds.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <Link href={primaryHref} className="btn-hero-primary" style={{ fontSize: "1.05rem", padding: "13px 26px" }}>
              Plan Your Outing →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
