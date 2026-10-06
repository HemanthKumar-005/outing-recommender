"use client";
import { useEffect, useState } from "react";
import RecommendationCard from "../../../components/RecommendationCard";
import { fetchInteractions, apiFetch } from "../../../lib/api";

export default function SavedPage() {
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Assume user_id = 1 for demo purposes unless available in session
        const interactions = await fetchInteractions(1);
        
        // Filter for saves/likes and deduplicate by place_id
        const savedPlaceIds = Array.from(new Set(
          interactions
            .filter((i: any) => i.type === "save" || i.type === "like")
            .map((i: any) => i.place_id)
        ));

        // Fetch place details
        const placeDetails = await Promise.all(
          savedPlaceIds.map(async (id) => {
            const res = await apiFetch(`places/places/${id}`);
            if (res.ok) return res.json();
            return null;
          })
        );
        
        setPlaces(placeDetails.filter(Boolean));
      } catch (err) {
        console.error("Failed to fetch saved places:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting">Saved places</h1>
        <p className="dash-sub">Places you have liked or bookmarked for later.</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
        {loading ? (
          <p>Loading...</p>
        ) : places.length > 0 ? (
          places.map((p) => (
            <RecommendationCard
              key={p.id}
              name={p.name}
              category={p.category}
              match={95} // Mock match percentage
              rating={p.rating}
              distance_km={p.distance_km || 2.5}
              price_range={p.price_range}
              reason="Saved by you"
              liked
            />
          ))
        ) : (
          <p className="empty fade-in" style={{ marginTop: 16 }}>
            No saved places yet.
          </p>
        )}
        <p className="hint">Likes from Discover appear here once the interaction service records them.</p>
      </div>
    </>
  );
}
