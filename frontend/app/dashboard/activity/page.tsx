"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUserInfo, fetchInteractions, fetchItineraries } from "../../../lib/api";

type ActivityItem = {
  id: string;
  timeLabel: string;
  icon: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
};

const DEMO_EVENTS = [
  { t: "Today", text: "Liked Loom & Leaf Café", icon: "❤️" },
  { t: "Today", text: "Skipped Hopworks Brewpub", icon: "⏭️" },
  { t: "Yesterday", text: "Viewed Central Green Park", icon: "👀" },
  { t: "Yesterday", text: "Created evening date itinerary", icon: "🗓️" },
  { t: "2 days ago", text: "Updated outing preferences", icon: "⚙️" },
];

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "Recent";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 5) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  } catch {
    return "Recent";
  }
}

export default function ActivityPage() {
  const user = getUserInfo();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadFeed = async () => {
      setLoading(true);
      try {
        const [interactions, itineraries] = await Promise.allSettled([
          fetchInteractions(user.id || 1),
          fetchItineraries(user.id || 1),
        ]);

        const items: ActivityItem[] = [];

        // Parse interactions
        if (interactions.status === "fulfilled" && Array.isArray(interactions.value)) {
          for (const it of interactions.value) {
            const type = String(it.type || it.event_type || "view").toLowerCase();
            let icon = "👀";
            let badge = "Viewed";
            let badgeColor = "rgba(148, 163, 184, 0.15)";

            if (type === "save" || type === "like") {
              icon = "❤️";
              badge = "Saved";
              badgeColor = "rgba(224, 122, 95, 0.15)";
            } else if (type === "rating") {
              icon = "⭐";
              badge = it.rating ? `Rated ${it.rating}★` : "Rated";
              badgeColor = "rgba(234, 179, 8, 0.15)";
            } else if (type === "skip") {
              icon = "⏭️";
              badge = "Skipped";
              badgeColor = "rgba(239, 68, 68, 0.15)";
            } else if (type === "visit") {
              icon = "📍";
              badge = "Visited";
              badgeColor = "rgba(34, 197, 94, 0.15)";
            }

            const ctxWeather = it.context?.weather;
            const subtitle = ctxWeather
              ? `Context: ${ctxWeather} ${it.context?.temp ? `· ${Math.round(it.context.temp)}°C` : ""}`
              : undefined;

            items.push({
              id: `int-${it.id || Math.random()}`,
              timeLabel: formatRelativeTime(it.ts || it.created_at),
              icon,
              title: `${badge} venue #${it.place_id}`,
              subtitle,
              badge,
              badgeColor,
            });
          }
        }

        // Parse itineraries
        if (itineraries.status === "fulfilled" && Array.isArray(itineraries.value)) {
          for (const itin of itineraries.value) {
            items.push({
              id: `itin-${itin.id || Math.random()}`,
              timeLabel: formatRelativeTime(itin.created_at || itin.start_time),
              icon: "🗓️",
              title: `Created "${itin.title || "Curated Itinerary"}"`,
              subtitle: `${itin.occasion ? itin.occasion.replace(/_/g, " ") : "Custom"} · ${itin.duration || "4-6 hrs"}`,
              badge: "Itinerary",
              badgeColor: "rgba(59, 130, 246, 0.15)",
            });
          }
        }

        if (mounted) {
          if (items.length > 0) {
            setActivities(items);
            setIsLive(true);
          } else {
            // Fallback to initial demo events with live status
            setActivities(
              DEMO_EVENTS.map((e, idx) => ({
                id: `demo-${idx}`,
                timeLabel: e.t,
                icon: e.icon,
                title: e.text,
              }))
            );
            setIsLive(false);
          }
        }
      } catch {
        if (mounted) {
          setActivities(
            DEMO_EVENTS.map((e, idx) => ({
              id: `demo-${idx}`,
              timeLabel: e.t,
              icon: e.icon,
              title: e.text,
            }))
          );
          setIsLive(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadFeed();
    return () => {
      mounted = false;
    };
  }, [user.id]);

  return (
    <>
      <div className="dash-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="dash-greeting">Activity Feed</h1>
            <p className="dash-sub">Chronological interaction and recommendation history in this workspace.</p>
          </div>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: "0.8rem",
              fontWeight: 600,
              background: isLive ? "rgba(34, 197, 94, 0.15)" : "rgba(148, 163, 184, 0.15)",
              color: isLive ? "#22c55e" : "var(--slate)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: isLive ? "#22c55e" : "var(--slate)",
              }}
            />
            {isLive ? "Live Database Feed" : "Demo Activity"}
          </span>
        </div>
      </div>

      <div className="card fade-in" style={{ maxWidth: 640 }}>
        {loading ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--slate)" }}>
            Loading live activity records...
          </div>
        ) : activities.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px" }}>
            <p style={{ fontSize: "1.8rem", margin: "0 0 8px" }}>🌱</p>
            <h3 style={{ margin: "0 0 6px" }}>No activity recorded yet</h3>
            <p style={{ color: "var(--slate)", fontSize: "0.9rem", margin: "0 0 16px" }}>
              Explore places, rate venues, or generate your first itinerary to populate this feed.
            </p>
            <Link href="/dashboard/date-planner" className="btn btn-primary btn-sm">
              Plan an Outing →
            </Link>
          </div>
        ) : (
          <div>
            {activities.map((e, i) => (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                  padding: "14px 0",
                  borderBottom: i < activities.length - 1 ? "1px solid var(--hairline)" : "none",
                }}
              >
                <span style={{ fontSize: "1.25rem", marginTop: 2 }}>{e.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--slate-strong)", fontWeight: 600, fontSize: "0.95rem" }}>
                      {e.title}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--slate)", whiteSpace: "nowrap" }}>
                      {e.timeLabel}
                    </span>
                  </div>
                  {e.subtitle && (
                    <div style={{ color: "var(--slate)", fontSize: "0.82rem", marginTop: 2 }}>
                      {e.subtitle}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
