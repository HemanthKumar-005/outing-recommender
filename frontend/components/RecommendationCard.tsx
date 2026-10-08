"use client";

import PlaceImage from "./PlaceImage";

type Props = {
  name: string;
  category: string;
  match: number;
  rating?: number;
  distance_km?: number;
  price_range?: number;
  reason?: string;
  weather_fit?: string;
  city?: string;
  onLike?: () => void;
  onSkip?: () => void;
  onWhy?: () => void;
  onAdd?: () => void;
  liked?: boolean;
  showWhy?: boolean;
  whyContent?: string;
};

export default function RecommendationCard({
  name,
  category,
  match,
  rating,
  distance_km,
  price_range,
  reason,
  weather_fit,
  city,
  onLike,
  onSkip,
  onWhy,
  onAdd,
  liked,
  showWhy,
  whyContent,
}: Props) {
  return (
    <div className="ticket fade-up">
      {/* Place image strip */}
      <div
        className="ticket-image"
        style={{
          width: "100%",
          height: 140,
          borderRadius: "var(--radius) var(--radius) 0 0",
          overflow: "hidden",
          background: "#f0ece6",
        }}
      >
        <PlaceImage placeName={name} category={category} city={city} style={{ borderRadius: 0 }} />
      </div>

      <div className="ticket-row">
        <div className="ticket-stub">
          <span className="ticket-score">{match}</span>
          <span className="ticket-score-label">match</span>
          <span className="ticket-category">{category}</span>
        </div>
        <div className="ticket-main">
          <h3 className="ticket-name">{name}</h3>
          <div className="ticket-meta">
            {price_range != null && `${"₹".repeat(price_range)} · `}
            {distance_km != null && `${distance_km} km`}
            {rating != null && ` · ${rating}/5`}
          </div>
          {(reason || weather_fit) && (
            <div className="reasons">
              {reason && <span className="reason-chip">{reason}</span>}
              {weather_fit && <span className="reason-chip">{weather_fit}</span>}
            </div>
          )}
          <div className="action-row">
            {onLike && (
              <button type="button" className={`btn-tiny ${liked ? "liked" : ""}`} onClick={onLike}>
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
              <button type="button" className="btn-tiny" onClick={onWhy}>
                {showWhy ? "Hide" : "Why this?"}
              </button>
            )}
          </div>
          {showWhy && whyContent && <pre className="breakdown">{whyContent}</pre>}
        </div>
      </div>
    </div>
  );
}
