"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ProductDemo from "../components/ProductDemo";
import EngineViz from "../components/EngineViz";
import WeatherDemo from "../components/WeatherDemo";
import FAQ from "../components/FAQ";
import { Icons } from "../components/Icons";
import { PRICING_PLANS } from "../lib/demo-data";
import { isAuthenticated } from "../lib/api";

function useInView(threshold = 0.12) {
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

const PIPELINE_STAGES = [
  {
    num: "01",
    title: "Candidate Generation",
    badge: "Spatial Filtering",
    color: "var(--teal-400)",
    bg: "var(--teal-500)",
    desc: "Scans 300+ venues within your geo radius, excluding closed venues, unverified hours, or budget mismatches.",
  },
  {
    num: "02",
    title: "Taste Match Matrix",
    badge: "Embeddings",
    color: "var(--coral-400)",
    bg: "var(--coral-500)",
    desc: "Projects individual taste vectors against category & ambience embeddings learned from previous outings.",
  },
  {
    num: "03",
    title: "Group Consensus",
    badge: "Least-Misery / Borda",
    color: "var(--violet-400)",
    bg: "var(--violet-500)",
    desc: "Aggregates multi-persona scores so no single opinion dominates and everyone leaves happy.",
  },
  {
    num: "04",
    title: "Live Context & Weather",
    badge: "Real-Time Sensor",
    color: "var(--amber-400)",
    bg: "var(--amber-500)",
    desc: "Checks rain probability, sun, and commute time; automatically queues indoor backup venues.",
  },
  {
    num: "05",
    title: "Serendipity & Diversity",
    badge: "Anti-Filter-Bubble",
    color: "var(--rose-400)",
    bg: "var(--rose-500)",
    desc: "Applies exploration weighting to introduce unexpected hidden gems alongside reliable favorites.",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated()) {
      router.replace("/dashboard");
    }
  }, [router]);

  if (!mounted) return null;
  if (isAuthenticated()) return null;

  return (
    <>
      <Navbar />
      <main>
        {/* =================================================================
            1. HERO SECTION WITH AMBIENT AURORA & RICH PRODUCT MOCKUP
            ================================================================= */}
        <section className="hero">
          <div className="hero-glow" />
          <div className="container hero-grid">
            <div className={`hero-copy ${mounted ? "hero-ready" : ""}`}>
              <div className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Icons.Sparkles size={14} style={{ color: "var(--coral-400)" }} />
                <span>Context-aware outing intelligence · Powered by hybrid ML</span>
              </div>

              <h1>
                Stop debating.
                <br />
                <span className="hero-italic" style={{
                  background: "var(--gradient-text)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  Start going.
                </span>
              </h1>

              <p className="lead">
                Personalized places and timed itineraries adapted to your group’s tastes,
                live weather forecasts, and current mood. Zero guesswork, zero WhatsApp debates.
              </p>

              <div className="hero-cta">
                <a href="#demo" className="btn btn-primary btn-lg">
                  Try the live demo
                  <Icons.ArrowUpRight size={18} style={{ marginLeft: 6 }} />
                </a>
                <Link href="/dashboard" className="btn btn-secondary btn-lg">
                  Open Dashboard
                </Link>
              </div>

              <div className="hero-trust">
                <span><Icons.Check size={14} style={{ color: "var(--teal-400)", marginRight: 4 }} /> Explainable by design</span>
                <span><Icons.ShieldCheck size={14} style={{ color: "var(--teal-400)", marginRight: 4 }} /> Private &amp; isolated</span>
                <span><Icons.Sparkles size={14} style={{ color: "var(--amber-400)", marginRight: 4 }} /> Public model card</span>
                <span><Icons.Star size={14} style={{ color: "var(--rose-400)", marginRight: 4 }} /> Free in early beta</span>
              </div>
            </div>

            {/* Interactive Hero Product Mockup */}
            <div className={`hero-visual ${mounted ? "hero-ready" : ""}`}>
              <div className="hero-mockup-wrapper">
                <div className="mockup-card-primary card">
                  <div className="mockup-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="badge" style={{ background: "var(--cat-food-bg)", color: "var(--cat-food)", border: "1px solid var(--cat-food-border)" }}>
                        <Icons.Food size={13} style={{ marginRight: 4 }} /> Café &amp; Bistro
                      </span>
                      <span className="badge" style={{ background: "rgba(20, 184, 166, 0.12)", color: "var(--teal-400)" }}>
                        <Icons.CloudSun size={13} style={{ marginRight: 4 }} /> Weather Safe
                      </span>
                    </div>
                    {/* Radial score badge */}
                    <div className="mockup-score-badge">
                      <span className="score-num">96%</span>
                      <span className="score-lbl">match</span>
                    </div>
                  </div>

                  <h3 style={{ margin: "14px 0 4px", fontSize: "1.35rem" }}>Northstar Garden Kitchen</h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", margin: "0 0 12px" }}>
                    Warm terracotta courtyard, quiet acoustic corners, and farm-to-table plates tailored for 3 people.
                  </p>

                  <div className="mockup-meta-tags">
                    <span className="tag">₹1,400 for two</span>
                    <span className="tag">1.2 km away</span>
                    <span className="tag">Verified hours</span>
                    <span className="tag" style={{ color: "var(--coral-400)" }}>Group consensus #1</span>
                  </div>

                  <div className="mockup-action-strip">
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      💡 Matched on: cozy ambience + craft coffee + low decibels
                    </span>
                    <Link href="/dashboard" className="btn btn-primary btn-sm">
                      Plan Outing ↗
                    </Link>
                  </div>
                </div>

                {/* Floating context card 1 */}
                <div className="mockup-floating-card mockup-card-top">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--teal-500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                      <Icons.CloudSun size={16} />
                    </div>
                    <div>
                      <strong style={{ fontSize: "0.82rem", display: "block" }}>Rain expected at 8 PM</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Covered patio already chosen</span>
                    </div>
                  </div>
                </div>

                {/* Floating context card 2 */}
                <div className="mockup-floating-card mockup-card-bottom">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--violet-500)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                      <Icons.Users size={16} />
                    </div>
                    <div>
                      <strong style={{ fontSize: "0.82rem", display: "block" }}>3-Friend Consensus</strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Least-Misery rule satisfied</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            2. SOCIAL PROOF & METRICS STRIP
            ================================================================= */}
        <section className="section" style={{ padding: "32px 0", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.15)" }}>
          <div className="container">
            <div className="metrics-strip">
              <div className="metric-box">
                <span className="metric-number">15,000+</span>
                <span className="metric-label">Outings Planned</span>
              </div>
              <div className="metric-box">
                <span className="metric-number">300+</span>
                <span className="metric-label">Curated Indian Venues</span>
              </div>
              <div className="metric-box">
                <span className="metric-number">94%</span>
                <span className="metric-label">First-Pick Consensus</span>
              </div>
              <div className="metric-box">
                <span className="metric-number">0</span>
                <span className="metric-label">Ad Trackers or Data Sold</span>
              </div>
            </div>

            <div className="quote-banner">
              <p className="quote-text">
                &ldquo;We used to waste 45 minutes on WhatsApp every Friday debating where to go.
                Nearby &amp; Co. gave us a place everyone loved in literally 10 seconds.&rdquo;
              </p>
              <div className="quote-author">
                <strong>Ananya &amp; Rohan</strong> · Friday Evening Date &amp; Dinner in Indiranagar, Bengaluru
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            3. INTERACTIVE PRODUCT DEMO
            ================================================================= */}
        <section id="demo" className="section section-paper">
          <div className="container">
            <Reveal>
              <div className="section-header center">
                <p className="eyebrow dark">01 / Try it yourself</p>
                <h2>
                  A better answer
                  <br />
                  than <span className="hero-italic">&ldquo;anywhere.&rdquo;</span>
                </h2>
                <p className="lead dark">
                  Set the scene. Nearby &amp; Co. weighs the signals that make a good
                  outing feel effortless.
                </p>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <ProductDemo />
            </Reveal>
          </div>
        </section>

        {/* =================================================================
            4. VISUAL HYBRID-RECOMMENDATION PIPELINE
            ================================================================= */}
        <section id="how-it-works" className="section">
          <div className="container">
            <Reveal>
              <div className="section-header center">
                <p className="eyebrow">02 / The architecture</p>
                <h2>
                  From &ldquo;what’s good?&rdquo;
                  <br />
                  to <span className="hero-italic" style={{
                    background: "var(--gradient-text)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}>&ldquo;let’s go.&rdquo;</span>
                </h2>
                <p className="lead">
                  How our 5-stage hybrid ranking pipeline filters chaos into a clear, weather-resilient plan.
                </p>
              </div>
            </Reveal>

            {/* Interactive Pipeline Diagram */}
            <div className="pipeline-interactive card">
              <div className="pipeline-stages-bar">
                {PIPELINE_STAGES.map((s, idx) => {
                  const isActive = activeStage === idx;
                  return (
                    <button
                      key={s.num}
                      type="button"
                      className={`pipeline-stage-btn ${isActive ? "active" : ""}`}
                      onClick={() => setActiveStage(idx)}
                      style={{
                        borderColor: isActive ? s.color : undefined,
                      }}
                    >
                      <span className="ps-num" style={{ color: isActive ? s.color : undefined }}>
                        {s.num}
                      </span>
                      <span className="ps-title">{s.title}</span>
                      <span className="ps-badge" style={{ background: isActive ? s.bg : undefined, color: isActive ? "#fff" : undefined }}>
                        {s.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Stage Detail Callout */}
              <div className="pipeline-detail-callout fade-in" key={activeStage}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                  <span className="eyebrow" style={{ color: PIPELINE_STAGES[activeStage].color }}>
                    Stage {PIPELINE_STAGES[activeStage].num} · {PIPELINE_STAGES[activeStage].badge}
                  </span>
                  <span className="badge" style={{ background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                    Executed in &lt;40ms
                  </span>
                </div>
                <h3 style={{ fontSize: "1.4rem", margin: "0 0 8px", color: "var(--text-primary)" }}>
                  {PIPELINE_STAGES[activeStage].title}
                </h3>
                <p style={{ fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                  {PIPELINE_STAGES[activeStage].desc}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================
            5. FEATURE BENTO GRID
            ================================================================= */}
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
                  body: "We blend individual tastes using Least-Misery and Borda aggregation without letting one loud voice hijack the evening.",
                  wide: true,
                },
                {
                  n: "02",
                  tag: "Keep moving",
                  title: "Weather-reactive plans",
                  body: "If unexpected rain hits your forecast, your itinerary already has a dry, covered alternative ready to go.",
                },
                {
                  n: "03",
                  tag: "Show your work",
                  title: "Explainable results",
                  body: "Every score comes with transparent reasons you can inspect: price fit, distance, quiet ambience, or weather safety.",
                },
                {
                  n: "04",
                  tag: "In the moment",
                  title: "Live re-ranking",
                  body: "Like or skip a venue and the model updates the remaining recommendations in real time without refreshing.",
                },
                {
                  n: "05",
                  tag: "Your pace",
                  title: "Explore ↔ Exploit dial",
                  body: "A single slider lets you toggle between safe neighborhood favorites and brand-new serendipitous discoveries.",
                },
                {
                  n: "06",
                  tag: "From day one",
                  title: "Zero cold-start delay",
                  body: "A brief 4-step onboarding gives you tailored recommendations immediately—no need to log 50 past check-ins first.",
                },
                {
                  n: "07",
                  tag: "Keeps learning",
                  title: "Closed-loop feedback",
                  body: "A gentle follow-up question after your outing refines your personal embeddings for next weekend.",
                },
              ].map((f, i) => (
                <Reveal key={f.n} delay={(i % 3) * 80}>
                  <div className={`feature-card ${f.wide ? "wide" : ""}`}>
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

        {/* =================================================================
            6. LIVE SHOWCASE: WEATHER DEMO & ENGINE VIZ SIDE-BY-SIDE
            ================================================================= */}
        <section className="section">
          <div className="container">
            <Reveal>
              <div className="section-header center">
                <p className="eyebrow">04 / Deep dive</p>
                <h2>
                  Signals that matter,
                  <br />
                  <span className="hero-italic" style={{
                    background: "var(--gradient-text)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}>
                    working together.
                  </span>
                </h2>
                <p className="lead">
                  Watch how real-time weather alerts and hybrid scoring compose into a reliable outing recommendation.
                </p>
              </div>
            </Reveal>

            <div className="grid-2" style={{ gap: 24, alignItems: "start" }}>
              <Reveal delay={100}>
                <div>
                  <h3 style={{ marginBottom: 12, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: 8 }}>
                    <Icons.CloudSun size={20} style={{ color: "var(--teal-400)" }} />
                    Weather-Reactive Route Swapping
                  </h3>
                  <WeatherDemo />
                </div>
              </Reveal>

              <Reveal delay={200}>
                <div>
                  <h3 style={{ marginBottom: 12, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: 8 }}>
                    <Icons.Sparkles size={20} style={{ color: "var(--coral-400)" }} />
                    Multi-Factor Score Composition
                  </h3>
                  <EngineViz />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* =================================================================
            7. MODEL CARD & TRANSPARENCY
            ================================================================= */}
        <section className="section section-paper">
          <div className="container">
            <Reveal>
              <div className="model-teaser">
                <div>
                  <p className="eyebrow dark">The receipt</p>
                  <h2>
                    No black box.
                    <br />
                    Just <span className="hero-italic">good reasons.</span>
                  </h2>
                  <p className="lead dark">
                    See the current model version, ranking weights, and offline
                    evaluation. We believe recommendation algorithms should be explainable by
                    default.
                  </p>
                  <Link href="/model-card" className="btn btn-primary">
                    See the full model card
                    <Icons.ArrowUpRight size={16} style={{ marginLeft: 6 }} />
                  </Link>
                </div>
                <div className="model-card-preview">
                  <div className="mcp-header">
                    <span className="mcp-badge">LIVE MODEL CARD</span>
                    <span className="mcp-public">public explainer</span>
                  </div>
                  <div className="mcp-row">
                    <span>MODEL VERSION</span>
                    <strong>context-ranker / v0.8.2</strong>
                  </div>
                  <div className="mcp-metrics">
                    {[
                      { key: "precision@5", val: "0.84" },
                      { key: "recall@5", val: "0.78" },
                      { key: "ndcg@5", val: "0.91" },
                      { key: "map", val: "0.82" },
                    ].map((m) => (
                      <div key={m.key} className="mcp-metric">
                        <span className="mcp-val">{m.val}</span>
                        <span className="mcp-key">{m.key}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mcp-note">Shared model · tenant-isolated data via PostgreSQL RLS</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* =================================================================
            8. FOR TEAMS / API SECTION
            ================================================================= */}
        <section id="teams" className="section">
          <div className="container">
            <Reveal>
              <div className="section-header">
                <p className="eyebrow">For teams &amp; businesses</p>
                <h2>
                  Outings, as an
                  <br />
                  <span className="hero-italic" style={{
                    background: "var(--gradient-text)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}>API.</span>
                </h2>
                <p className="lead">
                  Give your travel, hospitality, or community product a recommendation engine with one key per
                  workspace, explained results, and database-level isolation.
                </p>
              </div>
            </Reveal>

            <Reveal delay={100}>
              <div className="api-block">
                <div className="api-benefits">
                  <div className="api-benefit">
                    <span className="api-icon"><Icons.ShieldCheck size={20} style={{ color: "var(--coral-400)" }} /></span>
                    <div>
                      <strong>Isolated by row-level security</strong>
                      <p>Every tenant’s user profiles and interactions stay strictly in their own partition.</p>
                    </div>
                  </div>
                  <div className="api-benefit">
                    <span className="api-icon"><Icons.Sparkles size={20} style={{ color: "var(--amber-400)" }} /></span>
                    <div>
                      <strong>One call to get ranked, explained results</strong>
                      <p>Score breakdowns and natural-language explanations included with every response.</p>
                    </div>
                  </div>
                  <div className="api-benefit">
                    <span className="api-icon"><Icons.Navigation size={20} style={{ color: "var(--teal-400)" }} /></span>
                    <div>
                      <strong>Turn-by-turn road itineraries</strong>
                      <p>Generate Sequenced date and day trips with real urban travel durations.</p>
                    </div>
                  </div>
                  <Link href="/dashboard" className="btn btn-primary">
                    Open Dashboard ↗
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

// → returns ranked results with group consensus & reasons`}</pre>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* =================================================================
            9. PRICING SECTION
            ================================================================= */}
        <section id="pricing" className="section section-paper">
          <div className="container">
            <Reveal>
              <div className="section-header center">
                <p className="eyebrow dark">Simple for now</p>
                <h2>
                  Find your
                  <br />
                  <span className="hero-italic">starting point.</span>
                </h2>
                <p className="lead dark">
                  Free during early access. Pick a path and open the dashboard.
                </p>
              </div>
            </Reveal>

            <div className="pricing-grid">
              {PRICING_PLANS.map((plan, i) => (
                <Reveal key={plan.id} delay={i * 100}>
                  <div className={`pricing-card ${plan.highlighted ? "highlighted" : ""}`}>
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
                          <span className="check"><Icons.Check size={14} /></span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* =================================================================
            10. FAQ SECTION
            ================================================================= */}
        <section id="faq" className="section">
          <div className="container narrow">
            <Reveal>
              <div className="section-header center">
                <p className="eyebrow">Good questions</p>
                <h2>
                  Wondering
                  <br />
                  <span className="hero-italic" style={{
                    background: "var(--gradient-text)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}>how it works?</span>
                </h2>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <FAQ />
            </Reveal>
          </div>
        </section>

        {/* =================================================================
            11. FINAL CONVERSION CTA BANNER
            ================================================================= */}
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
                <p style={{ maxWidth: 480, margin: "0 auto 24px", color: "var(--on-paper-muted)", fontSize: "1.05rem" }}>
                  Join hundreds of planners who stopped browsing 40 Google tabs. Get your first personalized outing in 30 seconds.
                </p>
                <div className="hero-cta" style={{ justifyContent: "center" }}>
                  <Link href="/dashboard" className="btn btn-ink btn-lg">
                    Open Dashboard
                    <Icons.ArrowUpRight size={18} style={{ marginLeft: 6 }} />
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