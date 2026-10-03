"use client";

import { useState, useMemo, useEffect } from "react";
import { DEMO_PLACES } from "../lib/demo-data";

const MOODS = [
  { id: "slow", label: "Slow & easy", emoji: "☕" },
  { id: "curious", label: "Curious", emoji: "🔍" },
  { id: "night", label: "Make it a night", emoji: "🌙" },
];

export default function ProductDemo() {
  const [mood, setMood] = useState("slow");
  const [budget, setBudget] = useState(35);
  const [explore, setExplore] = useState(40);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => { setAnimKey((k) => k + 1); }, [mood, budget, explore, skipped]);

  const results = useMemo(() => {
    let list = [...DEMO_PLACES];
    if (mood === "slow") {
      list = list.sort((a, b) => {
        const aQuiet = a.ambience.toLowerCase().includes("quiet") || a.ambience.toLowerCase().includes("calm") ? 1 : 0;
        const bQuiet = b.ambience.toLowerCase().includes("quiet") || b.ambience.toLowerCase().includes("calm") ? 1 : 0;
        return bQuiet - aQuiet || b.match - a.match;
      });
    } else if (mood === "night") {
      list = list.sort((a, b) => {
        const aNight = ["bar","restaurant","cinema"].includes(a.category) ? 1 : 0;
        const bNight = ["bar","restaurant","cinema"].includes(b.category) ? 1 : 0;
        return bNight - aNight || b.match - a.match;
      });
    } else {
      list = list.sort((a, b) => b.match - a.match);
    }
    if (budget <= 25) list = list.filter((p) => p.price_range <= 2);
    else if (budget >= 55) list = list.filter((p) => p.price_range >= 2);
    if (explore > 60) list = list.sort((a, b) => a.match - b.match + (Math.random() - 0.5) * 10);
    return list.filter((p) => !skipped.has(p.id)).slice(0, 3).map((p, i) => ({
      ...p,
      match: Math.min(99, Math.max(72, p.match + (mood === "slow" && p.ambience.includes("Quiet") ? 4 : 0) - i * 2)),
    }));
  }, [mood, budget, explore, skipped]);

  const handleSkip = (id: number) => setSkipped((s) => new Set(s).add(id));
  const handleLike = (id: number) => setLiked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const reset = () => { setSkipped(new Set()); setLiked(new Set()); setAnimKey((k) => k + 1); };

  return (
    <div className="demo-shell">
      <div className="demo-controls">
        <div className="demo-control-block">
          <div className="demo-step">01</div>
          <div className="form-label">What’s the mood?</div>
          <div className="mood-pills">
            {MOODS.map((m) => (
              <button key={m.id} type="button" className={`mood-pill ${mood === m.id ? "active" : ""}`} onClick={() => setMood(m.id)}>
                <span className="mood-emoji">{m.emoji}</span>{m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="demo-control-block">
          <div className="demo-step">02</div>
          <div className="form-label">What feels right? <span className="budget-value">${budget} / person</span></div>
          <div className="slider-wrap">
            <span className="slider-edge">$15</span>
            <input type="range" min={15} max={70} step={5} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="premium-slider" />
            <span className="slider-edge">$70+</span>
          </div>
        </div>
        <div className="demo-control-block">
          <div className="demo-step">03</div>
          <div className="form-label">Something familiar or new?</div>
          <div className="slider-wrap">
            <span className="slider-edge">Familiar</span>
            <input type="range" min={0} max={100} step={5} value={explore} onChange={(e) => setExplore(Number(e.target.value))} className="premium-slider" />
            <span className="slider-edge">Explore</span>
          </div>
        </div>
        <div className="demo-weather-note">
          <span className="weather-icon">🌧</span>
          <div><strong>Light rain at 9 PM</strong><p>Outdoor plans get a backup</p></div>
        </div>
      </div>
      <div className="demo-results-panel">
        <div className="demo-results-header">
          <div>
            <span className="results-count">{results.length} places ranked for you</span>
            <span className="live-dot"><span className="pulse" /> live ranking</span>
          </div>
          <button type="button" className="btn-ghost-sm" onClick={reset}>Reset list</button>
        </div>
        <div className="demo-results-list" key={animKey}>
          {results.length === 0 ? (
            <p className="empty">No places left — try resetting or changing filters.</p>
          ) : results.map((p, i) => (
            <div key={p.id} className="demo-result-card" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="drc-visual" data-cat={p.category}>
                <span className="drc-icon">
                  {p.category === "cafe" && "☼"}
                  {p.category === "park" && "🌳"}
                  {p.category === "cinema" && "🎬"}
                  {p.category === "bar" && "🍸"}
                  {p.category === "museum" && "◌"}
                  {p.category === "restaurant" && "✦"}
                </span>
              </div>
              <div className="drc-body">
                <div className="drc-meta">
                  <span className="drc-cat">{p.category} · {p.distance_km} mi</span>
                  <span className="drc-match">{p.match}%</span>
                </div>
                <h4>{p.name}</h4>
                <p className="drc-reason">{p.reason.split("·")[0].trim()}</p>
                <div className="drc-tags">
                  {p.price_range <= 2 && <span className="tag">Under budget</span>}
                  {p.indoor && <span className="tag">Rain-safe</span>}
                  {p.ambience.toLowerCase().includes("quiet") && <span className="tag">Quiet</span>}
                  {i === 0 && <span className="tag">Local favorite</span>}
                </div>
              </div>
              <div className="drc-actions">
                <button type="button" className={`btn-tiny ${liked.has(p.id) ? "liked" : ""}`} onClick={() => handleLike(p.id)} title="Like">{liked.has(p.id) ? "♥" : "♡"}</button>
                <button type="button" className="btn-tiny" onClick={() => handleSkip(p.id)} title="Skip">Skip ↗</button>
              </div>
            </div>
          ))}
        </div>
        <p className="demo-footnote">Ranking updates instantly as you react.</p>
      </div>
    </div>
  );
}
