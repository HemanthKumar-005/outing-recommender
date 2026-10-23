"use client";

import { useState } from "react";
import PlaceImage from "./PlaceImage";
<<<<<<< HEAD
import ReportIssue from "./ReportIssue";
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

export type WeeklyHoursMap = Record<string, string[][]>;

export type RecommendationCardProps = {
<<<<<<< HEAD
  placeId?: number;
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
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
<<<<<<< HEAD
  hours_is_estimated?: boolean;
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
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
<<<<<<< HEAD
  placeId,
  hours_is_estimated,
  opening_hours_is_estimated,
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
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

  // Compute current day in Asia/Kolkata or user locale
  const now = new Date();
  const dayIndex = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6
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
<<<<<<< HEAD
      : "Price not available");
=======
      : `${approx}₹600 for two`);
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

  const displayEntryText =
    entry_text || (entry_fee && entry_fee > 0 ? `Entry: ₹${Math.round(entry_fee)}` : "");

  // Google Maps URL (free plain web URL)
  const mapsQuery = lat && lng ? `${lat},${lng}` : encodeURIComponent(`${name} ${city || ""}`);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

<<<<<<< HEAD
  // Hours are guesses unless the backend says otherwise: never present them as fact.
  const hoursEstimated = hours_is_estimated ?? opening_hours_is_estimated ?? true;

=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
  // Open/Closed badge configuration (Both Text and Colour)
  let badgeClass = "badge-hours badge-unavailable";
  let badgeIcon = "🕒";
  let badgeTitle = "Hours unavailable";

  if (open_now === true) {
    badgeClass = "badge-hours badge-open";
    badgeIcon = "●";
    badgeTitle = hours_detail && hours_detail.startsWith("Closes") ? hours_detail : "Open now";
  } else if (open_now === false) {
    badgeClass = "badge-hours badge-closed";
    badgeIcon = "○";
    badgeTitle = hours_detail && hours_detail.startsWith("Opens") ? hours_detail : "Closed";
  }

  // Combine reasons
  const combinedReasons: string[] = [];
  if (reason) combinedReasons.push(reason);
  if (weather_fit) combinedReasons.push(weather_fit);
  reasons.forEach((r) => {
    if (r && !combinedReasons.includes(r)) combinedReasons.push(r);
  });

  return (
    <article className="ticket fade-up place-card-enhanced" aria-label={`Recommendation for ${name}`}>
      {/* Place image strip */}
      <div
        className="ticket-image"
        style={{
          width: "100%",
          height: 140,
          borderRadius: "var(--radius) var(--radius) 0 0",
          overflow: "hidden",
          background: "#f0ece6",
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
      </div>

      <div className="ticket-row">
        <div className="ticket-stub">
          <span className="ticket-score">{match}</span>
          <span className="ticket-score-label">match</span>
          <span className="ticket-category">{category}</span>
        </div>

        <div className="ticket-main">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <h3 className="ticket-name" style={{ margin: 0 }}>{name}</h3>
            {/* Plain Google Maps link (costs nothing) */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="maps-link"
              title="Open venue details in Google Maps"
              aria-label={`Open ${name} in Google Maps`}
            >
              <span aria-hidden="true">📍</span> Maps ↗
            </a>
          </div>

          {/* Pricing & Key Meta Row */}
          <div className="ticket-meta" style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: "6px 12px" }}>
            <span className="meta-price" title={pricing_is_estimated ? "Estimated cost for two" : "Verified cost for two"}>
              <strong style={{ color: "var(--foreground, #111827)" }}>{symbols}</strong>
              {" · "}
              <span>{displayCostText}</span>
            </span>

            {displayEntryText && (
              <span className="meta-entry-fee" style={{ color: "var(--slate, #4b5563)" }}>
                {displayEntryText}
              </span>
            )}

            {distance_km != null && (
              <span className="meta-distance">
                {distance_km.toFixed(1)} km
              </span>
            )}

            {rating != null && (
              <span className="meta-rating">
                ★ {rating.toFixed(1)}/5
              </span>
            )}
          </div>

          {/* Opening Hours Schedule Widget */}
          <div className="hours-widget" style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <div style={{ fontSize: "0.85rem", color: "var(--foreground, #1f2937)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Today:</span>
                <span>{today_hours || (open_now === false ? "Closed" : "Hours unavailable")}</span>
<<<<<<< HEAD
                {hoursEstimated && (
                  <span className="badge-hours badge-unavailable" title="We could not verify this venue's hours. Check before you go.">
                    Estimated — verify ahead
                  </span>
                )}
=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
                {hours_detail && hours_detail !== today_hours && hours_detail !== "Hours unavailable" && (
                  <span style={{ color: "var(--muted, #6b7280)", fontSize: "0.8rem" }}>
                    ({hours_detail})
                  </span>
                )}
              </div>

<<<<<<< HEAD
              {!hoursEstimated && weekly_hours && Object.keys(weekly_hours).length > 0 && (
=======
              {weekly_hours && Object.keys(weekly_hours).length > 0 && (
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
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
<<<<<<< HEAD
            {!hoursEstimated && weeklyExpanded && weekly_hours && (
=======
            {weeklyExpanded && weekly_hours && (
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
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

          {/* Reasons Chips */}
          {combinedReasons.length > 0 && (
            <div className="reasons" style={{ marginTop: 8 }}>
              {combinedReasons.slice(0, 3).map((r, i) => (
                <span key={i} className="reason-chip">{r}</span>
              ))}
            </div>
          )}

<<<<<<< HEAD
          {placeId != null && (
            <div style={{ marginTop: 8 }}>
              <ReportIssue placeId={placeId} placeName={name} />
            </div>
          )}

=======
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
          {/* Action buttons */}
          <div className="action-row" style={{ marginTop: 12 }}>
            {onLike && (
              <button
                type="button"
                className={`btn-tiny ${liked ? "liked" : ""}`}
                onClick={onLike}
                aria-pressed={liked}
              >
                {liked ? "♥ Liked" : "♥ Like"}
              </button>
            )}
            {onSkip && (
              <button type="button" className="btn-tiny" onClick={onSkip}>
                ✕ Skip
              </button>
            )}
            {onAdd && (
              <button type="button" className="btn-tiny" onClick={onAdd}>
                ＋ Itinerary
              </button>
            )}
            {onWhy && (
              <button type="button" className="btn-tiny" onClick={onWhy} aria-expanded={showWhy}>
                {showWhy ? "Hide why" : "Why this?"}
              </button>
            )}
          </div>

          {showWhy && whyContent && (
            <pre className="breakdown fade-in" tabIndex={0} aria-label="Score breakdown details">
              {whyContent}
            </pre>
          )}
        </div>
      </div>
    </article>
  );
}
