"use client";

const EVENTS = [
  { t: "Today", text: "Liked Loom & Leaf Café" },
  { t: "Today", text: "Skipped Hopworks Brewpub" },
  { t: "Yesterday", text: "Viewed Central Green Park" },
  { t: "Yesterday", text: "Created evening itinerary" },
  { t: "2 days ago", text: "Updated preferences" },
];

export default function ActivityPage() {
  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting">Activity</h1>
        <p className="dash-sub">Recent interactions in this workspace.</p>
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        {EVENTS.map((e, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 16,
              padding: "12px 0",
              borderBottom: i < EVENTS.length - 1 ? "1px solid var(--hairline)" : "none",
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--slate)", width: 90 }}>
              {e.t}
            </span>
            <span style={{ color: "var(--slate-strong)", fontSize: "0.92rem" }}>{e.text}</span>
          </div>
        ))}
      </div>
    </>
  );
}
