"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "./context/AuthContext";
import StickyStorytelling from "./components/landing/StickyStorytelling";
import TravelRouteVisualization from "./components/landing/TravelRouteVisualization";
import InteractiveDiscovery from "./components/landing/InteractiveDiscovery";

const FAQS = [
  {
    q: "How does Nearby calculate travel time and distance?",
    a: "When you enter your starting point and destination, Nearby uses actual road network routing (OSRM) to calculate real driving, walking, cycling, or transit durations to each venue, so you know exactly how long the trip will take rather than relying on misleading straight-line distances.",
  },
  {
    q: "Can I plan an outing with friends who have different tastes?",
    a: "Yes! Nearby includes a smart group mode that balances everyone's preferences, budget, and favorite categories using multi-agent algorithmic consensus (Least Misery and Borda Count) so no one gets stuck at a place they dislike.",
  },
  {
    q: "Do I have to share my GPS or coordinates?",
    a: "No. You never need to share device location or understand geographic coordinates. Simply search any city, neighborhood, landmark, or street address and our geocoding maps it instantly.",
  },
  {
    q: "Can I book a table or get turn-by-turn directions?",
    a: "Yes! Every place card features an interactive map button, a one-click Google Maps turn-by-turn directions link from your starting point, and direct table booking links where supported.",
  },
  {
    q: "Is Nearby free to use?",
    a: "Yes, Nearby is completely free for exploring places and planning trips. You only pay for what you purchase or book directly at the venue.",
  },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const primaryHref = isAuthenticated ? "/planner" : "/login";

  // Intersection Observer for scroll-reveal staggered animations
  const revealRefs = useRef<(Element | null)[]>([]);

  const registerRef = useCallback((el: Element | null) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
    }
  }, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      revealRefs.current.forEach((el) => {
        if (el) el.classList.add("is-visible");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    revealRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page">
      {/* 1. Hero Section */}
      <section className="landing-hero">
        <div className="landing-container landing-hero-grid">
          {/* Left Column: Hero Content & CTAs */}
          <div className="hero-content reveal" ref={registerRef}>
            <div className="hero-eyebrow-pill">
              <span className="hero-eyebrow-dot" />
              <span>Context-Aware Outing Recommender · Bengaluru</span>
            </div>

            <h1 className="landing-hero-title">
              Plan the outing.
              <br />
              <span className="accent-text">Skip the debate.</span>
            </h1>

            <p className="landing-hero-sub">
              Nearby pairs real road-network travel times with AI-driven preference balancing.
              Discover curated cafes, scenic botanical walks, craft breweries, and cultural spots tailored to your mood, companions, and budget.
            </p>

            <div className="landing-hero-actions">
              <Link href={primaryHref} className="btn-hero-primary">
                <span>Start Planning Free</span>
                <span className="btn-arrow" aria-hidden="true">→</span>
              </Link>
              <a href="#how-it-works" className="btn-hero-secondary">
                <span>See How It Works</span>
              </a>
            </div>

            {/* Feature Highlights Pills */}
            <div className="hero-feature-pills">
              <div className="hero-feature-item">
                <span className="hero-feature-icon">🚗</span>
                <span>Real Road Routing</span>
              </div>
              <div className="hero-feature-item">
                <span className="hero-feature-icon">👥</span>
                <span>Group Harmony</span>
              </div>
              <div className="hero-feature-item">
                <span className="hero-feature-icon">🌤️</span>
                <span>Weather Matching</span>
              </div>
              <div className="hero-feature-item">
                <span className="hero-feature-icon">🕒</span>
                <span>Verified Hours</span>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Visual Collage Stage */}
          <div className="hero-visual-stage reveal" ref={registerRef}>
            {/* Background Route Graphic SVG */}
            <svg
              className="hero-route-svg"
              viewBox="0 0 500 500"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M 60 420 C 120 380, 160 300, 250 250 C 340 200, 380 120, 430 70"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeDasharray="6 6"
                strokeOpacity="0.45"
              />
              <circle cx="60" cy="420" r="6" fill="#087F73" />
              <circle cx="250" cy="250" r="5" fill="#13A89E" />
              <circle cx="430" cy="70" r="7" fill="#123F35" />
            </svg>

            {/* Interactive Image Frame 1 - Main Centerpiece */}
            <div className="hero-photo-card hero-photo-main">
              <img
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=85"
                alt="Windmills Craftworks Dining"
                className="hero-photo-img"
              />
              <div className="hero-photo-overlay" />
              <div className="hero-photo-caption">
                <span className="hero-photo-tag">Top Pick · 96% Match</span>
                <span className="hero-photo-title">Windmills Craftworks</span>
              </div>
            </div>

            {/* Interactive Image Frame 2 - Social Taproom */}
            <div className="hero-photo-card hero-photo-social">
              <img
                src="https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=500&q=80"
                alt="Toit Brewpub"
                className="hero-photo-img"
              />
              <div className="hero-photo-overlay" />
              <div className="hero-photo-caption">
                <span className="hero-photo-tag">Craft Brewery</span>
                <span className="hero-photo-title">Toit Indiranagar</span>
              </div>
            </div>

            {/* Interactive Image Frame 3 - Botanical Nature */}
            <div className="hero-photo-card hero-photo-park">
              <img
                src="https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=500&q=80"
                alt="Cubbon Park trails"
                className="hero-photo-img"
              />
              <div className="hero-photo-overlay" />
              <div className="hero-photo-caption">
                <span className="hero-photo-tag">Nature & Trails</span>
                <span className="hero-photo-title">Cubbon Park</span>
              </div>
            </div>

            {/* Floating Live Signal Cards */}
            <div className="hero-float-card hero-float-card-1">
              <div className="float-card-icon">⚡</div>
              <div>
                <p className="float-card-title">Real Road Route</p>
                <p className="float-card-sub">Koramangala → Indiranagar · 16 mins</p>
              </div>
            </div>

            <div className="hero-float-card hero-float-card-2">
              <div className="float-card-icon">🤝</div>
              <div>
                <p className="float-card-title">Group Harmony 94%</p>
                <p className="float-card-sub">4 friends agreed · Zero vetoes</p>
              </div>
            </div>

            <div className="hero-float-card hero-float-card-3">
              <div className="float-card-icon">🌤️</div>
              <div>
                <p className="float-card-title">Clear 22°C</p>
                <p className="float-card-sub">Perfect for outdoor seating</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How It Works (4 Clear Progressive Steps) */}
      <section id="how-it-works" className="landing-section landing-section-soft">
        <div className="landing-container">
          <div className="section-header-split">
            <div className="reveal" ref={registerRef}>
              <p className="eyebrow">Seamless Flow</p>
              <h2 className="section-heading">
                Four smart steps to <em>the perfect outing.</em>
              </h2>
            </div>
            <p className="section-lead reveal" ref={registerRef}>
              No endless group chats or conflicting schedules. Just enter where you are, who you&apos;re with, and let Nearby handle the rest.
            </p>
          </div>

          <div className="steps-grid stagger-children" ref={registerRef}>
            <div className="step-card" style={{ "--i": 0 } as React.CSSProperties}>
              <div className="step-card-num">01</div>
              <h3 className="step-card-title">Choose Your Destination</h3>
              <p className="step-card-desc">
                Search any city or district, or tap quick picks like Indiranagar, Koramangala, Cubbon Park, or Whitefield.
              </p>
              <div className="step-tag-row">
                <span className="step-mini-tag">Autocomplete Search</span>
                <span className="step-mini-tag">Popular Hubs</span>
              </div>
            </div>

            <div className="step-card" style={{ "--i": 1 } as React.CSSProperties}>
              <div className="step-card-num">02</div>
              <h3 className="step-card-title">Set Your Starting Point &amp; Mode</h3>
              <p className="step-card-desc">
                Tell us where you are starting from. Select car, bus/metro, bicycle, or walking to compute authentic road network travel durations.
              </p>
              <div className="step-tag-row">
                <span className="step-mini-tag">OSRM Road Router</span>
                <span className="step-mini-tag">4 Travel Modes</span>
              </div>
            </div>

            <div className="step-card" style={{ "--i": 2 } as React.CSSProperties}>
              <div className="step-card-num">03</div>
              <h3 className="step-card-title">Select Outing Vibe &amp; Group</h3>
              <p className="step-card-desc">
                Pick your outing type—Casual Hangout, Romantic Date, or Family Outing. Enable group mode to balance budgets and avoid anyone&apos;s dislikes.
              </p>
              <div className="step-tag-row">
                <span className="step-mini-tag">Least Misery Consensus</span>
                <span className="step-mini-tag">Budget Matching</span>
              </div>
            </div>

            <div className="step-card" style={{ "--i": 3 } as React.CSSProperties}>
              <div className="step-card-num">04</div>
              <h3 className="step-card-title">Explore on Map &amp; Reserve</h3>
              <p className="step-card-desc">
                View scored matches on an interactive map. Inspect photos, live open hours, weather fitness, and open turn-by-turn navigation in one tap.
              </p>
              <div className="step-tag-row">
                <span className="step-mini-tag">Interactive Map</span>
                <span className="step-mini-tag">Table Reservations</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SIGNATURE EXPERIENCE 1: Sticky Destination Storytelling */}
      <StickyStorytelling primaryHref={primaryHref} />

      {/* 4. SIGNATURE EXPERIENCE 2: Animated Travel Route Visualization */}
      <TravelRouteVisualization primaryHref={primaryHref} />

      {/* 5. SIGNATURE EXPERIENCE 3: Interactive Destination Discovery Preview */}
      <InteractiveDiscovery primaryHref={primaryHref} />

      {/* 6. Travel-Smart Bento Features */}
      <section id="travel-smart" className="landing-section landing-section-soft">
        <div className="landing-container">
          <div className="section-header reveal" ref={registerRef}>
            <p className="eyebrow">Intelligent Recommender</p>
            <h2 className="section-heading">
              Engineered with <em>context awareness.</em>
            </h2>
            <p className="section-lead">
              Most discovery apps dump thousands of pins on a map. Nearby synthesizes six contextual signals to recommend places that genuinely fit your exact moment.
            </p>
          </div>

          <div className="bento-grid stagger-children" ref={registerRef}>
            <div className="bento-card" style={{ "--i": 0 } as React.CSSProperties}>
              <div className="bento-kicker">OSRM Routing</div>
              <h3 className="bento-title">Real Road Distances</h3>
              <p className="bento-desc">
                We calculate genuine driving, walking, and cycling times from your exact starting neighborhood, not just misleading straight-line distances.
              </p>
            </div>

            <div className="bento-card" style={{ "--i": 1 } as React.CSSProperties}>
              <div className="bento-kicker">Interactive Maps</div>
              <h3 className="bento-title">Full Map Integration</h3>
              <p className="bento-desc">
                Explore recommended venues on an interactive map, view pin popups, and launch Google Maps turn-by-turn navigation in one tap.
              </p>
            </div>

            <div className="bento-card" style={{ "--i": 2 } as React.CSSProperties}>
              <div className="bento-kicker">Weather-Smart</div>
              <h3 className="bento-title">Live Weather Matching</h3>
              <p className="bento-desc">
                Sunny afternoon? We suggest open-air gardens and rooftop bistros. Rainy evening? Cozy indoor lounges, artisan cafes, and museums.
              </p>
            </div>

            <div className="bento-card wide" style={{ "--i": 3 } as React.CSSProperties}>
              <div className="bento-kicker">Group Harmony</div>
              <h3 className="bento-title">Fair for Every Group Member</h3>
              <p className="bento-desc">
                Planning with four friends? Our group balancer finds places that satisfy everyone&apos;s tastes and budgets, so no one feels left out.
              </p>
              <div className="signal-bar-row">
                <span>Vibe &amp; Category Match</span>
                <div className="signal-track">
                  <div className="signal-fill signal-fill-animated" style={{ width: "95%" }} />
                </div>
                <span>95%</span>
              </div>
              <div className="signal-bar-row">
                <span>Distance &amp; Travel Convenience</span>
                <div className="signal-track">
                  <div className="signal-fill signal-fill-animated" style={{ width: "92%", animationDelay: "0.5s" }} />
                </div>
                <span>92%</span>
              </div>
              <div className="signal-bar-row">
                <span>Weather &amp; Timing Fit</span>
                <div className="signal-track">
                  <div className="signal-fill signal-fill-animated" style={{ width: "88%", animationDelay: "0.7s" }} />
                </div>
                <span>88%</span>
              </div>
            </div>

            <div className="bento-card" style={{ "--i": 4 } as React.CSSProperties}>
              <div className="bento-kicker">No Closed Doors</div>
              <h3 className="bento-title">Verified Operating Hours</h3>
              <p className="bento-desc">
                Every venue is cross-checked against current day-of-week hours so you never encounter locked doors when you arrive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FAQ Section */}
      <section id="faq" className="landing-section">
        <div className="landing-container faq-grid">
          <div className="section-header reveal" ref={registerRef}>
            <p className="eyebrow">Frequently Asked Questions</p>
            <h2 className="section-heading">
              Got <em>questions?</em>
            </h2>
            <p className="section-lead">
              Everything you need to know about planning your next outing with Nearby &amp; Co.
            </p>
          </div>

          <div className="stagger-children" ref={registerRef}>
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div className="faq-item" key={item.q} style={{ "--i": idx } as React.CSSProperties}>
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

      {/* 9. Closing Call to Action Banner */}
      <section className="closing-band">
        <div className="landing-container reveal" ref={registerRef}>
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