"use client";

import Link from "next/link";
import { getUserInfo } from "../../lib/api";
import { DEMO_PLACES, ITINERARY_DEMO } from "../../lib/demo-data";
import RecommendationCard from "../../components/RecommendationCard";

export default function DashboardHome() {
  const user = getUserInfo();
  const hour = typeof window !== "undefined" ? new Date().getHours() : 18;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting">
          {greeting}, {user.name} 👋
        </h1>
        <p className="dash-sub">Here&apos;s what we found for you.</p>
      </div>

      <div className="dash-grid">
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3>Personalized picks</h3>
            <Link href="/dashboard/recommendations" className="btn btn-secondary btn-sm">
              See all
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {DEMO_PLACES.slice(0, 3).map((p) => (
              <RecommendationCard
                key={p.id}
                name={p.name}
                category={p.category}
                match={p.match}
                rating={p.rating}
                distance_km={p.distance_km}
                price_range={p.price_range}
                reason={p.reason.split(" · ")[0]}
              />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <p className="eyebrow">Context</p>
            <h3 style={{ marginBottom: 8 }}>Evening picks</h3>
            <p style={{ color: "var(--slate)", fontSize: "0.9rem", margin: 0 }}>
              Partly cloudy · 27°C · Great for indoor or covered outdoor spots.
            </p>
          </div>

          <div className="card">
            <p className="eyebrow">Upcoming itinerary</p>
            <div className="timeline" style={{ marginTop: 12 }}>
              {ITINERARY_DEMO.slice(0, 2).map((s) => (
                <div className="timeline-item" key={s.time}>
                  <div className="timeline-dot" />
                  <div className="timeline-time">{s.time}</div>
                  <div className="timeline-place" style={{ fontSize: "1rem" }}>{s.place}</div>
                </div>
              ))}
            </div>
            <Link href="/dashboard/itineraries" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
              View itineraries
            </Link>
          </div>

          <div className="card">
            <p className="eyebrow">Quick actions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <Link href="/dashboard/date-planner" className="btn btn-primary btn-sm">
                💖 Plan a Date
              </Link>
              <Link href="/dashboard/discover" className="btn btn-secondary btn-sm">
                🎲 Surprise Me & Discover
              </Link>
              <Link href="/dashboard/groups" className="btn btn-secondary btn-sm">
                👥 Plan with a group
              </Link>
              <Link href="/dashboard/settings" className="btn btn-ghost btn-sm">
                ⚙️ Edit preferences
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
