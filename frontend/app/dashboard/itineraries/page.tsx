"use client";
import { ITINERARY_DEMO } from "../../../lib/demo-data";

export default function ItinerariesPage() {
  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting">Itineraries</h1>
        <p className="dash-sub">Timed plans with travel notes and weather awareness.</p>
      </div>
      <div className="card" style={{ maxWidth: 520 }}>
        <h3 style={{ marginBottom: 16 }}>Tonight&apos;s plan</h3>
        <div className="timeline">
          {ITINERARY_DEMO.map((stop) => (
            <div className="timeline-item" key={stop.time}>
              <div className="timeline-dot" />
              <div className="timeline-time">{stop.time}</div>
              <div className="timeline-place">{stop.place}</div>
              <div className="timeline-meta">
                {stop.category} · {stop.distance} · {stop.note}
              </div>
            </div>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 16 }}>
          Connect to the itinerary service to create and swap stops with live weather workers.
        </p>
      </div>
    </>
  );
}
