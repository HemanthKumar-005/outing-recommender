"use client";
import { useEffect, useState } from "react";
import { fetchItineraries } from "../../../lib/api";

export default function ItinerariesPage() {
  const [itineraries, setItineraries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchItineraries(1); // Assume user 1 for demo
        setItineraries(data);
      } catch (err) {
        console.error("Failed to fetch itineraries", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting">Itineraries</h1>
        <p className="dash-sub">Timed plans with travel notes and weather awareness.</p>
      </div>
      <div className="card" style={{ maxWidth: 520 }}>
        <h3 style={{ marginBottom: 16 }}>Your Plans</h3>
        {loading ? (
          <p>Loading...</p>
        ) : itineraries.length > 0 ? (
          itineraries.map((itinerary) => (
            <div key={itinerary.id} style={{ marginBottom: 24, padding: 12, border: "1px solid var(--hairline)", borderRadius: 8 }}>
              <h4 style={{ margin: "0 0 8px" }}>{itinerary.title}</h4>
              <p style={{ fontSize: "0.85rem", color: "var(--slate)", margin: "0 0 12px" }}>{itinerary.description}</p>
              <div className="timeline">
                {itinerary.items?.map((stop: any) => (
                  <div className="timeline-item" key={stop.id}>
                    <div className="timeline-dot" />
                    <div className="timeline-time">
                      {new Date(stop.arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="timeline-place">{stop.name}</div>
                    <div className="timeline-meta">
                      {stop.category}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="empty fade-in" style={{ marginTop: 16 }}>
            No itineraries generated yet.
          </p>
        )}
        <p className="hint" style={{ marginTop: 16 }}>
          Connect to the itinerary service to create and swap stops with live weather workers.
        </p>
      </div>
    </>
  );
}
