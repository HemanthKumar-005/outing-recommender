"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ProductDemo from "../components/ProductDemo";
import FAQ from "../components/FAQ";
import { PRICING_PLANS } from "../lib/demo-data";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView(0.12);
  return (
    <div
      ref={ref}
      className={`reveal ${inView ? "revealed" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const FLOATING_CARDS = [
  {
    id: 2,
    label: "02",
    title: "Riverside walk",
    sub: "weather-safe route",
    time: "TONIGHT · 7:30 PM",
    match: 94,
    accent: "brass",
  },
  {
    id: 1,
    label: "",
    title: "Northstar Kitchen",
    sub: "Warm plates, low light, room for the whole table.",
    tags: ["Good fit for your group", "$$ · 1.2 mi"],
    match: 96,
    accent: "paper",
  },
  {
    id: 3,
    label: "03",
    title: "Gallery late night",
    sub: "something new",
    match: 91,
    accent: "burgundy",
  },
];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <Navbar />
      <main>
        <section className="hero">
          <div className="hero-glow" />
          <div className="container hero-grid">
            <div className={`hero-copy ${mounted ? "hero-ready" : ""}`}>
              <p className="eyebrow">Context-aware outing recommendations</p>
              <h1>
                Stop debating.
                <br />
                <span className="hero-italic">Start going.</span>
              </h1>
              <p className="lead">
                Personalized places and plans for the people, weather, and mood
                you have right now.
              </p>
              <div className="hero-cta">
                <a href="#demo" className="btn btn-primary btn-lg">
                  Try the live demo
                  <span className="btn-arrow">↗</span>
                </a>
                <Link href="/signup" className="btn btn-secondary btn-lg">
                  Create a workspace
                </Link>
              </div>
              <div className="hero-trust">
                <span>✓ Explainable by design</span>
                <span>✓ Your data stays private</span>
                <span>✓ Public model card</span>
              </div>
            </div>

            <div className={`hero-visual ${mounted ? "hero-ready" : ""}`}>
              <div className="float-stack">
                {FLOATING_CARDS.map((card, i) => (
                  <div
                    key={card.id}
                    className={`float-card float-card-${card.accent} float-delay-${i}`}
                  >
                    {card.label && (
                      <span className="float-label">{card.label}</span>
                    )}
                    {card.time && (
                      <div className="float-meta">
                        <span>{card.time}</span>
                        <span className="match-pill">{card.match}% match</span>
                      </div>
                    )}
                    <h3>{card.title}</h3>
                    <p>{card.sub}</p>
                    {card.tags && (
                      <div className="float-tags">
                        {card.tags.map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="demo" className="section section-paper">
          <div className="container">
            <Reveal>
              <div className="section-header center">
                <p className="eyebrow dark">01 / Try it yourself</p>
                <h2>
                  A better answer
                  <br />
                  than <span className="hero-italic">“anywhere.”</span>
                </h2>
                <p className="lead dark">
                  Set the scene. Nearby & Co. weighs the signals that make a good
                  outing feel effortless.
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <ProductDemo />
            </Reveal>
          </div>
        </section>

        <section id="how-it-works" className="section">
          <div className="container">
            <Reveal>
              <div className="section-header">
                <p className="eyebrow">02 / The short version</p>
                <h2>
                  From “what’s good?”
                  <br />
                  to <span className="hero-italic">“let’s go.”</span>
                </h2>
                <p className="lead">
                  Three signals in. One plan everyone can feel good about.
                </p>
              </div>
            </Reveal>

            <div className="steps-grid">
              {[
                {
                  n: "01",
                  title: "Tell us your taste",
                  body: "And who’s coming. We learn what a good time looks like for your group.",
                },
                {
                  n: "02",
                  title: "We score every place",
                  body: "Taste, budget, weather, time of day, and a little bit of serendipity.",
                },
                {
                  n: "03",
                  title: "Your plan adapts",
                  body: "Get a ranked list and an itinerary that can change when the sky does.",
                },
              ].map((s, i) => (
                <Reveal key={s.n} delay={i * 100}>
                  <div className="step-card">
                    <span className="step-n">{s.n}</span>
                    <h3>{s.title}</h3>
                    <p>{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={200}>
              <div className="pipeline">
                <p className="pipeline-label">The ranking pipeline</p>
                <div className="pipeline-steps">
                  {[
                    "Candidates",
                    "Taste match",
                    "Group signal",
                    "Context",
                    "Diversity",
                  ].map((label, i) => (
                    <div key={label} className="pipeline-step">
                      <span className="pipeline-num">{i + 1}</span>
                      <span>{label}</span>
                      {i < 4 && <span className="pipeline-line" />}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="features" className="section section-paper">
          <div className="container">
            <Reveal>
              <div className="section-header">
                <p className="eyebrow dark">03 / Built different</p>
                <h2>
                  Seven reasons
                  <br />
                  it feels <span className="hero-italic">right.</span>
                </h2>
              </div>
            </Reveal>

            <div className="features-bento">
              {[
                {
                  n: "01",
                  tag: "Group consensus",
                  title: "Score for the whole table",
                  body: "We blend individual tastes without letting one loud opinion win.",
                  wide: true,
                },
                {
                  n: "02",
                  tag: "Keep moving",
                  title: "Weather-reactive plans",
                  body: "If rain is coming, your itinerary already has a better idea.",
                },
                {
                  n: "03",
                  tag: "Show your work",
                  title: "Explainable results",
                  body: "Every score comes with a reason you can actually understand.",
                },
                {
                  n: "04",
                  tag: "In the moment",
                  title: "Live re-ranking",
                  body: "Skip or like a result and the list responds instantly.",
                },
                {
                  n: "05",
                  tag: "Your pace",
                  title: "Explore ↔ exploit",
                  body: "A simple dial between safe bet and new favorite.",
                },
                {
                  n: "06",
                  tag: "From day one",
                  title: "No history needed",
                  body: "Good results for new people and new places alike.",
                },
                {
                  n: "07",
                  tag: "Keeps learning",
                  title: "A closed loop",
                  body: "A gentle follow-up helps the next plan get better.",
                },
              ].map((f, i) => (
                <Reveal key={f.n} delay={(i % 3) * 80}>
                  <div
                    className={`feature-card ${f.wide ? "wide" : ""}`}
                  >
                    <div className="feature-top">
                      <span className="feature-n">{f.n}</span>
                      <span className="feature-tag">{f.tag}</span>
                    </div>
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <Reveal>
              <div className="model-teaser">
                <div>
                  <p className="eyebrow">The receipt</p>
                  <h2>
                    No black box.
                    <br />
                    Just <span className="hero-italic">good reasons.</span>
                  </h2>
                  <p className="lead">
                    See the current model version, ranking weights, and offline
                    evaluation. We think recommendations should be explainable by
                    default.
                  </p>
                  <Link href="/model-card" className="btn btn-primary">
                    See the full model card
                    <span className="btn-arrow">↗</span>
                  </Link>
                </div>
                <div className="model-card-preview">
                  <div className="mcp-header">
                    <span className="mcp-badge">LIVE MODEL CARD</span>
                    <span className="mcp-public">public explainer</span>
                  </div>
                  <div className="mcp-row">
                    <span>MODEL VERSION</span>
                    <strong>context-ranker / v0.8</strong>
                  </div>
                  <div className="mcp-metrics">
                    {["precision@5", "recall@5", "ndcg@5", "map"].map((m) => (
                      <div key={m} className="mcp-metric">
                        <span className="mcp-val">—</span>
                        <span className="mcp-key">{m}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mcp-note">Shared model · tenant-isolated data</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="teams" className="section section-paper">
          <div className="container">
            <Reveal>
              <div className="section-header">
                <p className="eyebrow dark">For teams & businesses</p>
                <h2>
                  Outings, as an
                  <br />
                  <span className="hero-italic">API.</span>
                </h2>
                <p className="lead dark">
                  Give your product a recommendation engine with one key per
                  workspace, explained results, and isolation enforced at the data
                  layer.
                </p>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="api-block">
                <div className="api-benefits">
                  <div className="api-benefit">
                    <span className="api-icon">🔒</span>
                    <div>
                      <strong>Isolated by row-level security</strong>
                      <p>Every tenant’s data stays in its own sandbox.</p>
                    </div>
                  </div>
                  <div className="api-benefit">
                    <span className="api-icon">⚡</span>
                    <div>
                      <strong>One call to get ranked, explained results</strong>
                      <p>
                        Score breakdowns and plain-language reasons included.
                      </p>
                    </div>
                  </div>
                  <div className="api-benefit">
                    <span className="api-icon">📡</span>
                    <div>
                      <strong>Events & webhooks-ready architecture</strong>
                      <p>
                        React to likes, skips, and itinerary updates in real
                        time.
                      </p>
                    </div>
                  </div>
                  <Link href="/signup" className="btn btn-primary">
                    Create a workspace
                  </Link>
                </div>
                <div className="api-code">
                  <div className="code-header">
                    <span className="code-dot red" />
                    <span className="code-dot yellow" />
                    <span className="code-dot green" />
                    <span className="code-title">request.sh</span>
                  </div>
                  <pre>{`curl -X POST https://api.nearby.co/v1/recommendations \\
  -H "X-API-Key: YOUR_WORKSPACE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_ids": [1, 2, 3],
    "outing_type": "friends",
    "top_k": 5
  }'

// → ranked results, with reasons`}</pre>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="pricing" className="section">
          <div className="container">
            <Reveal>
              <div className="section-header center">
                <p className="eyebrow">Simple for now</p>
                <h2>
                  Find your
                  <br />
                  <span className="hero-italic">starting point.</span>
                </h2>
                <p className="lead">
                  Free during early access. Pick a path and start planning.
                </p>
              </div>
            </Reveal>

            <div className="pricing-grid">
              {PRICING_PLANS.map((plan, i) => (
                <Reveal key={plan.id} delay={i * 100}>
                  <div
                    className={`pricing-card ${plan.highlighted ? "highlighted" : ""}`}
                  >
                    <div className="pricing-top">
                      <span className="pricing-name">{plan.name}</span>
                      {plan.highlighted && (
                        <span className="pricing-badge">Popular</span>
                      )}
                    </div>
                    <div className="pricing-price">
                      <span className="price">{plan.price}</span>
                      <span className="period">{plan.period}</span>
                    </div>
                    <p className="pricing-desc">{plan.description}</p>
                    <Link
                      href={plan.href}
                      className={`btn ${plan.highlighted ? "btn-primary" : "btn-secondary"} btn-block`}
                    >
                      {plan.cta}
                    </Link>
                    <ul className="pricing-features">
                      {plan.features.map((f) => (
                        <li key={f}>
                          <span className="check">✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="section section-paper">
          <div className="container narrow">
            <Reveal>
              <div className="section-header center">
                <p className="eyebrow dark">Good questions</p>
                <h2>
                  Wondering
                  <br />
                  <span className="hero-italic">how it works?</span>
                </h2>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <FAQ />
            </Reveal>
          </div>
        </section>

        <section className="section cta-section">
          <div className="container">
            <Reveal>
              <div className="cta-block">
                <p className="eyebrow dark">The next good thing</p>
                <h2>
                  Make the plan.
                  <br />
                  Not the debate.
                </h2>
                <div className="hero-cta" style={{ justifyContent: "center" }}>
                  <Link href="/signup" className="btn btn-ink btn-lg">
                    Start planning
                    <span className="btn-arrow">↗</span>
                  </Link>
                  <Link href="/model-card" className="btn btn-ghost-dark btn-lg">
                    View the model card
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}