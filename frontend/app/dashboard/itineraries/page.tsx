"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchItineraries, itineraryCalendarUrl, shareItinerary } from "../../../lib/api";
import { Icons } from "../../../components/Icons";

export default function ItinerariesPage() {
  const [itineraries, setItineraries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchItineraries(1);
        setItineraries(data);
      } catch (err) {
        console.error("Failed to fetch itineraries", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleShare = async (id: number) => {
    try {
      const { path } = await shareItinerary(id);
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <div className="dash-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="dash-greeting">Saved Itineraries</h1>
            <p className="dash-sub">Sequenced date plans with travel notes and weather awareness.</p>
          </div>
          <Link href="/dashboard/date-planner" className="btn btn-primary btn-sm">
            + Plan New Date Outing
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 640 }}>
        {loading ? (
          <div className="skeleton-container fade-in">
            <div className="skeleton-line" style={{ height: 160, width: "100%", borderRadius: 12, marginBottom: 16 }} />
            <div className="skeleton-line" style={{ height: 160, width: "100%", borderRadius: 12 }} />
          </div>
        ) : itineraries.length > 0 ? (
          itineraries.map((itinerary) => (
            <div
              key={itinerary.id}
              className="card fade-up"
              style={{
                marginBottom: 24,
                padding: 20,
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "1.25rem", color: "var(--text-primary)" }}>{itinerary.title}</h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", margin: 0 }}>{itinerary.description}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleShare(itinerary.id)}
                    title="Share read-only plan"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Icons.Share size={13} />
                    <span>{copiedId === itinerary.id ? "Copied!" : "Share"}</span>
                  </button>
                  <a
                    className="btn btn-secondary btn-sm"
                    href={itineraryCalendarUrl(itinerary.id)}
                    download
                    title="Download .ics calendar file"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Icons.Calendar size={13} />
                    <span>.ics</span>
                  </a>
                </div>
              </div>

              {/* Vertical timeline stops */}
              <div className="timeline" style={{ marginTop: 16 }}>
                {itinerary.items?.map((stop: any, idx: number) => (
                  <div key={stop.id || idx} style={{ marginBottom: 10 }}>
                    <div className="timeline-item">
                      <div className="timeline-dot" style={{ background: "var(--coral-500)", boxShadow: "0 0 8px rgba(224,94,58,0.4)" }} />
                      <div className="timeline-time" style={{ fontFamily: "var(--font-mono)", color: "var(--coral-400)" }}>
                        {stop.arrival ? new Date(stop.arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `Stop ${idx + 1}`}
                      </div>
                      <div className="timeline-place" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{stop.name}</div>
                      {stop.category && (
                        <div className="timeline-meta">
                          <span className="tag" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", textTransform: "capitalize" }}>
                            {stop.category}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="card empty-state-card fade-in" style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(224, 94, 58, 0.12)", color: "var(--coral-400)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Icons.Itineraries size={26} />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.2rem", color: "var(--text-primary)" }}>No itineraries saved yet</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", margin: "0 0 20px" }}>
              Use the Date Planner to sequence your favorite venues into timed, road-navigated outings.
            </p>
            <Link href="/dashboard/date-planner" className="btn btn-primary">
              Generate Your First Plan ↗
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
