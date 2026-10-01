"use client";
import { DEMO_PLACES } from "../../../lib/demo-data";
import RecommendationCard from "../../../components/RecommendationCard";

export default function SavedPage() {
  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting">Saved places</h1>
        <p className="dash-sub">Places you have liked or bookmarked for later.</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
        {DEMO_PLACES.slice(0, 2).map((p) => (
          <RecommendationCard
            key={p.id}
            name={p.name}
            category={p.category}
            match={p.match}
            rating={p.rating}
            distance_km={p.distance_km}
            price_range={p.price_range}
            reason="Saved by you"
            liked
          />
        ))}
        <p className="hint">Likes from Discover appear here once the interaction service records them.</p>
      </div>
    </>
  );
}
