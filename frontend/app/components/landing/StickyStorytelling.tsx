"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface StoryStage {
  id: string;
  step: string;
  tag: string;
  headline: string;
  subtitle: string;
  description: string;
  highlights: string[];
  image: string;
  locationName: string;
  locationArea: string;
  rating: string;
}

const STORY_STAGES: StoryStage[] = [
  {
    id: "discover",
    step: "01",
    tag: "DISCOVER",
    headline: "Find places worth stepping out for.",
    subtitle: "Handpicked experiences and verified venues across Bengaluru.",
    description:
      "Say goodbye to opening ten browser tabs and doomscrolling through stale directories. Nearby curates verified restaurants, artisanal cafes, tranquil botanical trails, and craft taprooms with verified operating hours and ratings.",
    highlights: ["100+ Curated Spots", "★ 4.6+ Average Rating", "Verified Day-of-Week Hours"],
    image: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=85",
    locationName: "Lalbagh Botanical Garden",
    locationArea: "South Bengaluru · Scenic & Botanical",
    rating: "4.8",
  },
  {
    id: "personalize",
    step: "02",
    tag: "PERSONALIZE",
    headline: "Every outing should feel personal.",
    subtitle: "Tailored to your mood, company, and timing.",
    description:
      "Whether you're after a late-night craft brew with friends, a quiet candlelit acoustic dinner for two, or a sunny Sunday morning park stroll with the kids, recommendations adapt dynamically to who you're with.",
    highlights: ["Vibe-Aware Matching", "Couple, Family & Friends Modes", "Category Filters"],
    image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1000&q=85",
    locationName: "Toit Brewpub & Taproom",
    locationArea: "Indiranagar · Social & Nightlife",
    rating: "4.7",
  },
  {
    id: "balance",
    step: "03",
    tag: "BALANCE",
    headline: "Everyone gets a say. Nobody misses out.",
    subtitle: "Algorithmic group harmony with zero vetoes.",
    description:
      "Planning an outing with three friends who have different budgets and dietary tastes? Our multi-agent group consensus engine (Least Misery & Borda Count) calculates a balanced pick so everyone enjoys the trip without compromise.",
    highlights: ["Least Misery Consensus", "Budget Alignment", "Travel Convenience"],
    image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1000&q=85",
    locationName: "Third Wave Coffee Roasters",
    locationArea: "Koramangala · Social Coffee & Treats",
    rating: "4.6",
  },
  {
    id: "explore",
    step: "04",
    tag: "EXPLORE",
    headline: "Your next memorable outing starts here.",
    subtitle: "Real road routes, live weather, and table reservations.",
    description:
      "No straight-line guesswork. Nearby calculates genuine driving, transit, cycling, and walking durations along real road networks, accounts for current weather conditions, and provides one-tap turn-by-turn directions directly to your venue.",
    highlights: ["Real Road Routing (OSRM)", "Live Weather Fitting", "1-Tap Navigation"],
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=85",
    locationName: "Windmills Craftworks",
    locationArea: "Whitefield · Jazz & Dining",
    rating: "4.8",
  },
];

interface StickyStorytellingProps {
  primaryHref: string;
}

export default function StickyStorytelling({ primaryHref }: StickyStorytellingProps) {
  const [activeStage, setActiveStage] = useState<number>(0);
  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (isMobile) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-stage-index"));
            if (!Number.isNaN(index)) {
              setActiveStage(index);
            }
          }
        });
      },
      {
        threshold: 0.5,
        rootMargin: "-10% 0px -25% 0px",
      }
    );

    stageRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const currentStage = STORY_STAGES[activeStage] || STORY_STAGES[0];

  return (
    <section className="sticky-story-section" aria-label="Interactive Destination Storytelling">
      <div className="landing-container">
        {/* Section Header */}
        <div className="section-header-split">
          <div>
            <p className="eyebrow">Interactive Journey</p>
            <h2 className="section-heading">
              How Nearby transforms <em>every outing.</em>
            </h2>
          </div>
          <p className="section-lead">
            Scroll to discover how intelligent venue matching, route computation, and group harmony turn planning into an effortless adventure.
          </p>
        </div>

        {/* Storytelling Grid */}
        <div className="sticky-story-grid">
          {/* Left Column: Sticky Destination Visual Composition */}
          <div className="sticky-story-visual-wrap">
            <div className="sticky-story-visual-stage">
              {/* Progress Indicator Dots */}
              <div className="story-stage-indicator-bar" role="tablist" aria-label="Story stages">
                {STORY_STAGES.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`story-stage-dot-btn ${activeStage === idx ? "active" : ""}`}
                    onClick={() => {
                      setActiveStage(idx);
                      stageRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    aria-label={`Jump to stage ${idx + 1}: ${s.tag}`}
                  >
                    <span className="story-stage-dot-number">{s.step}</span>
                    <span className="story-stage-dot-label">{s.tag}</span>
                  </button>
                ))}
              </div>

              {/* Layered Image Display with Smooth Crossfade */}
              <div className="story-image-canvas">
                {STORY_STAGES.map((stage, idx) => (
                  <div
                    key={stage.id}
                    className={`story-image-layer ${activeStage === idx ? "active" : ""}`}
                    aria-hidden={activeStage !== idx}
                  >
                    <img
                      src={stage.image}
                      alt={stage.locationName}
                      className="story-image"
                      loading={idx === 0 ? "eager" : "lazy"}
                    />
                    <div className="story-image-overlay" />
                  </div>
                ))}

                {/* Floating Destination Detail Card */}
                <div className="story-floating-badge" key={currentStage.id}>
                  <div className="story-floating-badge-top">
                    <span className="story-badge-pill">{currentStage.tag}</span>
                    <span className="story-rating-pill">★ {currentStage.rating}</span>
                  </div>
                  <h4 className="story-floating-title">{currentStage.locationName}</h4>
                  <p className="story-floating-sub">{currentStage.locationArea}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Narrative Scrolling Stages */}
          <div className="sticky-story-narrative-column">
            {STORY_STAGES.map((stage, index) => (
              <div
                key={stage.id}
                ref={(el) => {
                  stageRefs.current[index] = el;
                }}
                data-stage-index={index}
                className={`story-narrative-card ${activeStage === index ? "active" : ""}`}
              >
                <div className="story-step-eyebrow">
                  <span className="story-step-badge">Stage {stage.step}</span>
                  <span className="story-step-tag">{stage.tag}</span>
                </div>

                <h3 className="story-narrative-heading">{stage.headline}</h3>
                <h4 className="story-narrative-subtitle">{stage.subtitle}</h4>
                <p className="story-narrative-desc">{stage.description}</p>

                <div className="story-highlights-list">
                  {stage.highlights.map((h) => (
                    <div key={h} className="story-highlight-pill">
                      <span className="story-highlight-check" aria-hidden="true">✓</span>
                      <span>{h}</span>
                    </div>
                  ))}
                </div>

                {/* Mobile-only inline preview image */}
                <div className="story-mobile-image-preview">
                  <img
                    src={stage.image}
                    alt={stage.locationName}
                    className="story-mobile-img"
                    loading="lazy"
                  />
                  <div className="story-mobile-badge">
                    <strong>{stage.locationName}</strong> · ★ {stage.rating}
                  </div>
                </div>

                {index === STORY_STAGES.length - 1 && (
                  <div style={{ marginTop: "24px" }}>
                    <Link href={primaryHref} className="btn-hero-primary" style={{ padding: "12px 24px", fontSize: "0.94rem" }}>
                      Plan Your Outing Now →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
