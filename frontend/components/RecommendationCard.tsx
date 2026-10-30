"use client";

import { useState } from "react";
import PlaceImage from "./PlaceImage";
import ReportIssue from "./ReportIssue";
import { Icons } from "./Icons";

export type WeeklyHoursMap = Record<string, string[][]>;

export type RecommendationCardProps = {
  placeId?: number;
  name: string;
  category: string;
  match: number;
  rating?: number;
  distance_km?: number;
  price_range?: number;
  cost_for_two?: number;
  entry_fee?: number;
  cost_text?: string;
  entry_text?: string;
  price_symbols?: string;
  pricing_is_estimated?: boolean;
  open_now?: boolean | null;
  hours_status?: string;
  hours_detail?: string;
  today_hours?: string;
  weekly_hours?: WeeklyHoursMap;
  opening_hours_is_estimated?: boolean;
  hours_is_estimated?: boolean;
  lat?: number;
  lng?: number;
  city?: string;
  reason?: string;
  weather_fit?: string;
  reasons?: string[];
  onLike?: () => void;
  onSkip?: () => void;
  onWhy?: () => void;
  onAdd?: () => void;
  liked?: boolean;
  showWhy?: boolean;
  whyContent?: string;
};

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const ORDERED_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function formatTime12(t: string): string {
  try {
    const parts = t.split(":");
    const h = parseInt(parts[0], 10);
    const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    if (h === 24 && m === 0) return "12 AM";
    const ampm = h < 12 || h === 24 ? "AM" : "PM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${displayH} ${ampm}` : `${displayH}:${m.toString().padStart(2, "0")} ${ampm}`;
  } catch {
    return t;
  }
}

function formatDayRanges(ranges?: string[][]): string {
  if (!ranges || ranges.length === 0) return "Closed";
  return ranges
    .map(([start, end]) => `${formatTime12(start)} – ${formatTime12(end)}`)
    .join(", ");
}

/**
 * Circular Match Score Ring with Gradient SVG Arc
 */
function MatchScoreRing({ score }: { score: number }) {
  const radius = 22;
  const strokeWidth = 3.5;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score));
  const dashoffset = circumference - (progress / 100) * circumference;

  let strokeColor = "url(#matchGradientHigh)";
  if (score < 80) strokeColor = "url(#matchGradientMid)";
  if (score < 70) strokeColor = "url(#matchGradientLow)";

  return (
    <div className="match-score-ring" title={`${score}% Match Score`}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <defs>
          <linearGradient id="matchGradientHigh" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--teal-400)" />
            <stop offset="100%" stopColor="var(--coral-400)" />
          </linearGradient>
          <linearGradient id="matchGradientMid" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--coral-400)" />
            <stop offset="100%" stopColor="var(--amber-400)" />
          </linearGradient>
          <linearGradient id="matchGradientLow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--amber-400)" />
            <stop offset="100%" stopColor="var(--neutral-400)" />
          </linearGradient>
        </defs>
        {/* Background track */}
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform="rotate(-90 28 28)"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="match-score-text">
        <span className="match-score-val">{score}</span>
        <span className="match-score-pct">%</span>
      </div>
    </div>
  );
}

export default function RecommendationCard({
  name,
  category,
  match,
  rating,
  distance_km,
  price_range = 2,
  cost_for_two,
  entry_fee,
  cost_text,
  entry_text,
  price_symbols,
  pricing_is_estimated = true,
  placeId,
  hours_is_estimated,
  opening_hours_is_estimated,
  open_now,
  hours_status,
  hours_detail,
  today_hours,
  weekly_hours,
  lat,
  lng,
  city,
  reason,
  weather_fit,
  reasons = [],
  onLike,
  onSkip,
  onWhy,
  onAdd,
  liked,
  showWhy,
  whyContent,
}: RecommendationCardProps) {
  const [weeklyExpanded, setWeeklyExpanded] = useState(false);

  // Compute current day in India locale
  const now = new Date();
  const dayIndex = (now.getDay() + 6) % 7;
  const currentDayKey = ORDERED_DAYS[dayIndex];

  // Pricing display calculation
  const symbols = price_symbols || (price_range > 0 ? "₹".repeat(Math.min(4, price_range)) : "Free");
  const approx = pricing_is_estimated ? "~" : "";
  const displayCostText =
    cost_text ||
    (cost_for_two !== undefined && cost_for_two !== null
      ? cost_for_two === 0
        ? "Free entry"
        : `${approx}₹${Math.round(cost_for_two)} for two`
      : "Price not available");

  const displayEntryText =
    entry_text || (entry_fee && entry_fee > 0 ? `Entry: ₹${Math.round(entry_fee)}` : "");

  // Google Maps URL
  const mapsQuery = lat && lng ? `${lat},${lng}` : encodeURIComponent(`${name} ${city || ""}`);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const hoursEstimated = hours_is_estimated ?? opening_hours_is_estimated ?? true;

  // Open/Closed badge configuration
  let badgeClass = "badge-hours badge-unavailable";
  let badgeIcon = <Icons.Clock size={12} />;
  let badgeTitle = "Hours unavailable";

  if (open_now === true) {
    badgeClass = "badge-hours badge-open";
    badgeIcon = <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />;
    badgeTitle = hours_detail && hours_detail.startsWith("Closes") ? hours_detail : "Open now";
  } else if (open_now === false) {
    badgeClass = "badge-hours badge-closed";
    badgeIcon = <span style={{ width: 6, height: 6, borderRadius: "50%", border: "1px solid currentColor", display: "inline-block" }} />;
    badgeTitle = hours_detail && hours_detail.startsWith("Opens") ? hours_detail : "Closed";
  }

  // Combine reasons
  const combinedReasons: string[] = [];
  if (reason) combinedReasons.push(reason);
  if (weather_fit) combinedReasons.push(weather_fit);
  reasons.forEach((r) => {
    if (r && !combinedReasons.includes(r)) combinedReasons.push(r);
  });

  const getCategoryTheme = (cat: string) => {
    const c = (cat || "").toLowerCase();
    if (c.includes("cafe") || c.includes("restaurant") || c.includes("food")) {
      return { color: "var(--cat-food)", bg: "var(--cat-food-bg)", border: "var(--cat-food-border)", Icon: Icons.Food };
    }
    if (c.includes("park") || c.includes("outdoor") || c.includes("garden")) {
      return { color: "var(--cat-outdoors)", bg: "var(--cat-outdoors-bg)", border: "var(--cat-outdoors-border)", Icon: Icons.Outdoors };
    }
    if (c.includes("bar") || c.includes("brewery") || c.includes("nightlife")) {
      return { color: "var(--cat-nightlife)", bg: "var(--cat-nightlife-bg)", border: "var(--cat-nightlife-border)", Icon: Icons.Nightlife };
    }
    if (c.includes("museum") || c.includes("art") || c.includes("gallery") || c.includes("heritage")) {
      return { color: "var(--cat-culture)", bg: "var(--cat-culture-bg)", border: "var(--cat-culture-border)", Icon: Icons.Culture };
    }
    return { color: "var(--cat-romantic)", bg: "var(--cat-romantic-bg)", border: "var(--cat-romantic-border)", Icon: Icons.Sparkles };
  };

  const theme = getCategoryTheme(category);
  const CategoryIcon = theme.Icon;

  return (
    <article
      className="ticket fade-up place-card-enhanced"
      aria-label={`Recommendation for ${name}`}
      style={{
        borderTop: `2px solid ${theme.color}`,
        position: "relative",
      }}
    >
      {/* Place image strip */}
      <div
        className="ticket-image"
        style={{
          width: "100%",
          height: 140,
          borderRadius: "var(--radius) var(--radius) 0 0",
          overflow: "hidden",
          background: "var(--bg-surface-elevated)",
          position: "relative",
        }}
      >
        <PlaceImage placeName={name} category={category} city={city} style={{ borderRadius: 0 }} />

        {/* Floating status badge on image */}
        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 2 }}>
          <span className={badgeClass} title={hours_detail || badgeTitle}>
            <span className="badge-dot" aria-hidden="true">{badgeIcon}</span>
            <span className="badge-text">{badgeTitle}</span>
          </span>
        </div>

        {/* Floating Category Pill on Image */}
        <div style={{ position: "absolute", bottom: 10, left: 10, zIndex: 2 }}>
          <span
            className="badge"
            style={{
              background: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              border: `1px solid ${theme.border}`,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: "0.78rem",
            }}
          >
            <CategoryIcon size={13} style={{ color: theme.color }} />
            <span style={{ textTransform: "capitalize" }}>{category}</span>
          </span>
        </div>
      </div>

      <div className="ticket-row">
        {/* Match Score Ring Stub */}
        <div className="ticket-stub" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <MatchScoreRing score={match} />
          <span className="ticket-score-label" style={{ marginTop: 4, letterSpacing: "0.08em" }}>MATCH</span>
        </div>

        <div className="ticket-main">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <h3 className="ticket-name" style={{ margin: 0, fontSize: "1.22rem" }}>{name}</h3>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="maps-link"
              title="Open venue details in Google Maps"
              aria-label={`Open ${name} in Google Maps`}
              style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.82rem" }}
            >
              <Icons.Navigation size={12} /> Maps <Icons.ArrowUpRight size={12} />
            </a>
          </div>

          {/* Pricing & Key Meta Row */}
          <div className="ticket-meta" style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "center" }}>
            <span className="meta-price" title={pricing_is_estimated ? "Estimated cost for two" : "Verified cost for two"}>
              <strong style={{ color: "var(--text-primary)" }}>{symbols}</strong>
              {" · "}
              <span>{displayCostText}</span>
            </span>

            {displayEntryText && (
              <span className="meta-entry-fee" style={{ color: "var(--text-muted)" }}>
                {displayEntryText}
              </span>
            )}

            {distance_km != null && (
              <span className="meta-distance" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Icons.MapPin size={12} /> {distance_km.toFixed(1)} km
              </span>
            )}

            {rating != null && (
              <span className="meta-rating" style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--amber-400)" }}>
                <Icons.Star size={13} /> {rating.toFixed(1)}/5
              </span>
            )}
          </div>

          {/* Opening Hours Schedule Widget */}
          <div className="hours-widget" style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600 }}>Today:</span>
                <span>{today_hours || (open_now === false ? "Closed" : "Hours unavailable")}</span>
                {hoursEstimated && (
                  <span className="badge-hours badge-unavailable" title="We could not verify this venue's hours. Check before you go.">
                    Estimated — verify ahead
                  </span>
                )}
                {hours_detail && hours_detail !== today_hours && hours_detail !== "Hours unavailable" && (
                  <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                    ({hours_detail})
                  </span>
                )}
              </div>

              {!hoursEstimated && weekly_hours && Object.keys(weekly_hours).length > 0 && (
                <button
                  type="button"
                  className="btn-hours-toggle"
                  onClick={() => setWeeklyExpanded(!weeklyExpanded)}
                  aria-expanded={weeklyExpanded}
                  aria-label={weeklyExpanded ? "Hide weekly hours" : "View full weekly schedule"}
                >
                  {weeklyExpanded ? "Weekly schedule ▴" : "Weekly schedule ▾"}
                </button>
              )}
            </div>

            {/* Expandable Weekly Hours View */}
            {!hoursEstimated && weeklyExpanded && weekly_hours && (
              <div className="weekly-schedule-dropdown fade-in" role="region" aria-label="Weekly hours schedule">
                <table className="weekly-table">
                  <tbody>
                    {ORDERED_DAYS.map((dKey) => {
                      const isToday = dKey === currentDayKey;
                      const dayRanges = weekly_hours[dKey];
                      return (
                        <tr key={dKey} className={isToday ? "weekly-row-today" : ""}>
                          <td className="day-name">
                            {DAY_LABELS[dKey]} {isToday && <span className="today-chip">Today</span>}
                          </td>
                          <td className="day-hours">
                            {formatDayRanges(dayRanges)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Reasons Chips with semantic highlights */}
          {combinedReasons.length > 0 && (
            <div className="reasons" style={{ marginTop: 8 }}>
              {combinedReasons.slice(0, 3).map((r, i) => (
                <span key={i} className="reason-chip" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Icons.Check size={11} style={{ color: "var(--teal-400)" }} />
                  <span>{r}</span>
                </span>
              ))}
            </div>
          )}

          {placeId != null && (
            <div style={{ marginTop: 8 }}>
              <ReportIssue placeId={placeId} placeName={name} />
            </div>
          )}

          {/* Action buttons */}
          <div className="action-row" style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {onLike && (
              <button
                type="button"
                className={`btn-tiny ${liked ? "liked" : ""}`}
                onClick={onLike}
                aria-pressed={liked}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Icons.Heart size={13} fill={liked ? "currentColor" : "none"} />
                <span>{liked ? "Saved" : "Save"}</span>
              </button>
            )}
            {onSkip && (
              <button
                type="button"
                className="btn-tiny"
                onClick={onSkip}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Icons.Close size={12} />
                <span>Skip</span>
              </button>
            )}
            {onAdd && (
              <button
                type="button"
                className="btn-tiny"
                onClick={onAdd}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Icons.Calendar size={13} />
                <span>+ Itinerary</span>
              </button>
            )}
            {onWhy && (
              <button
                type="button"
                className="btn-tiny"
                onClick={onWhy}
                aria-expanded={showWhy}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Icons.Info size={13} />
                <span>{showWhy ? "Hide why" : "Why this?"}</span>
              </button>
            )}
          </div>

          {/* Sleek Score Breakdown Drawer */}
          {showWhy && whyContent && (
            <div className="fade-in" style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg-surface-elevated)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                <span>Hybrid Scoring Breakdown</span>
                <span>Match: {match}%</span>
              </div>
              <pre className="breakdown" style={{ margin: 0, padding: 0, background: "transparent", border: "none", color: "var(--text-secondary)" }} tabIndex={0}>
                {whyContent}
              </pre>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
