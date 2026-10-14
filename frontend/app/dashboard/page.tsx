"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserInfo, getRecommendations, fetchItineraries } from "../../lib/api";
import { DEMO_PLACES, ITINERARY_DEMO } from "../../lib/demo-data";
import RecommendationCard from "../../components/RecommendationCard";

type PickItem = {
  id: number;
  name: string;
  category: string;
  match: number;
  rating: number;
  distance_km?: number;
  price_range?: number;
  cost_for_two?: number;
  open_now?: boolean;
  hours_status?: string;
  hours_detail?: string;
  today_hours?: string;
  weekly_hours?: any;
  lat?: number;
  lng?: number;
  city?: string;
  reason?: string;
};

type ItinSummary = {
  id: number;
  title: string;
  occasion?: string;
  stops: Array<{ time: string; place: string }>;
};

export default function DashboardHome() {
  const user = getUserInfo();
  const hour = typeof window !== "undefined" ? new Date().getHours() : 18;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const [picks, setPicks] = useState<PickItem[]>([]);
  const [latestItin, setLatestItin] = useState<ItinSummary | null>(null);
  const [contextNote, setContextNote] = useState<string>("Partly cloudy · 27°C · Great for indoor or covered outdoor spots.");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [recsRes, itinsRes] = await Promise.allSettled([
          getRecommendations({
            user_id: user.id || 1,
            lat: 12.9716,
            lng: 77.5946,
            limit: 3,
          }),
          fetchItineraries(user.id || 1),
        ]);

        if (mounted) {
          // Process recommendations
          if (recsRes.status === "fulfilled" && recsRes.value?.recommendations?.length > 0) {
            const list: PickItem[] = recsRes.value.recommendations.slice(0, 3).map((r: any) => ({
              id: r.place.id,
              name: r.place.name,
              category: r.place.category,
              match: Math.round((r.score || 0.85) * 100),
              rating: r.place.rating || 4.5,
              distance_km: r.place.distance_km ? Math.round(r.place.distance_km * 10) / 10 : 2.5,
              price_range: r.place.price_range ?? 2,
              cost_for_two: r.place.cost_for_two ?? 800,
              open_now: r.place.open_now ?? true,
              hours_status: r.place.hours_status || "Open Now",
              hours_detail: r.place.hours_detail || "Closes 11:00 PM",
              today_hours: r.place.today_hours || "11:00 AM – 11:00 PM",
              weekly_hours: r.place.weekly_hours,
              lat: r.place.lat,
              lng: r.place.lng,
              city: r.place.city || "Bengaluru",
              reason: (r.explanation || "Top AI profile match").split(" · ")[0],
            }));
            setPicks(list);

            if (recsRes.value.context) {
              const ctx = recsRes.value.context;
              const weather = ctx.weather || "Clear";
              const temp = ctx.temp ? `${Math.round(ctx.temp)}°C` : "26°C";
              const advice = ctx.indoor_preferred
                ? "Favoring cozy indoor & covered venues."
                : "Pleasant conditions for outdoor seating & exploration.";
              setContextNote(`${weather} · ${temp} · ${advice}`);
            }
          } else {
            setPicks(DEMO_PLACES.slice(0, 3));
          }

          // Process itineraries
          if (itinsRes.status === "fulfilled" && Array.isArray(itinsRes.value) && itinsRes.value.length > 0) {
            const first = itinsRes.value[0];
            const timeline = first.timeline_meta || [];
            const stops = timeline.slice(0, 3).map((s: any) => ({
              time: s.time || "6:00 PM",
              place: s.place_name || s.activity || "Curated Stop",
            }));
            setLatestItin({
              id: first.id,
              title: first.title || "Curated Itinerary",
              occasion: first.occasion,
              stops: stops.length > 0 ? stops : ITINERARY_DEMO.slice(0, 2),
            });
          }
        }
      } catch {
        if (mounted) {
          setPicks(DEMO_PLACES.slice(0, 3));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, [user.id]);

  const displayedPicks = picks.length > 0 ? picks : DEMO_PLACES.slice(0, 3);
  const displayedStops = latestItin?.stops && latestItin.stops.length > 0 ? latestItin.stops : ITINERARY_DEMO.slice(0, 2);

  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting">
          {greeting}, {user.name} 👋
        </h1>
        <p className="dash-sub">Here&apos;s your live personalized outing feed and upcoming plans.</p>
      </div>

      <div className="dash-grid">
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0 }}>Personalized picks</h3>
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "#22c55e",
                  fontWeight: 600,
                }}
              >
                ● Live AI Rank
              </span>
            </div>
            <Link href="/dashboard/recommendations" className="btn btn-secondary btn-sm">
              See all
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {displayedPicks.map((p) => (
              <RecommendationCard
                key={p.id}
                name={p.name}
                category={p.category}
                match={p.match}
                rating={p.rating}
                distance_km={p.distance_km}
                price_range={p.price_range}
                cost_for_two={p.cost_for_two}
                open_now={p.open_now}
                hours_status={p.hours_status}
                hours_detail={p.hours_detail}
                today_hours={p.today_hours}
                weekly_hours={p.weekly_hours}
                lat={p.lat}
                lng={p.lng}
                city={p.city}
                reason={(p.reason || "Top match").split(" · ")[0]}
              />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <p className="eyebrow">Context & Atmosphere</p>
            <h3 style={{ marginBottom: 8 }}>Today&apos;s Conditions</h3>
            <p style={{ color: "var(--slate)", fontSize: "0.9rem", margin: 0, lineHeight: 1.5 }}>
              {contextNote}
            </p>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p className="eyebrow" style={{ margin: 0 }}>Upcoming itinerary</p>
              {latestItin && (
                <span style={{ fontSize: "0.75rem", color: "var(--brass-bright)", fontWeight: 600 }}>
                  Active Plan
                </span>
              )}
            </div>
            {latestItin && (
              <h4 style={{ margin: "6px 0 0", fontSize: "1rem", color: "var(--slate-strong)" }}>
                {latestItin.title}
              </h4>
            )}
            <div className="timeline" style={{ marginTop: 12 }}>
              {displayedStops.map((s, idx) => (
                <div className="timeline-item" key={`${s.time}-${idx}`}>
                  <div className="timeline-dot" />
                  <div className="timeline-time">{s.time}</div>
                  <div className="timeline-place" style={{ fontSize: "0.98rem" }}>{s.place}</div>
                </div>
              ))}
            </div>
            <Link href="/dashboard/itineraries" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
              View all itineraries
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
              <Link href="/dashboard/activity" className="btn btn-ghost btn-sm">
                📜 View activity history
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
