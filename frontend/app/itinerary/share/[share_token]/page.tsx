import { notFound } from "next/navigation";

// Public read-only itinerary view — no auth required
export default async function SharedItinerary({ params }: { params: { share_token: string } }) {
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");
  const res = await fetch(
    `${apiBase}/api/itinerary/share/${params.share_token}`,
    { cache: "no-store" }
  );
  if (!res.ok) return notFound();
  const plan = await res.json();

  const icsDownloadUrl = `${apiBase}/api/itinerary/share/${params.share_token}/export.ics`;

  return (
    <main className="page">
      <div className="top-row">
        <div>
          <p className="eyebrow">Shared itinerary · Read only</p>
          <h1>{plan.title || "Outing Plan"}</h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <a
            href={icsDownloadUrl}
            download
            className="btn-secondary"
            style={{ textDecoration: "none", fontSize: "0.85rem", padding: "6px 12px" }}
          >
            📅 Export .ics
          </a>
        </div>
      </div>
      <div className="card fade-in">
        {plan.stops?.map((stop: any, i: number) => {
          const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
            stop.place_name || "Outing Stop"
          )}&details=${encodeURIComponent(
            `Category: ${stop.category || "venue"}${
              stop.booking_url ? `\nReservation: ${stop.booking_url}` : ""
            }`
          )}&location=${encodeURIComponent(
            stop.lat && stop.lng ? `${stop.lat}, ${stop.lng}` : ""
          )}`;

          return (
            <div
              key={i}
              style={{
                marginBottom: "1.25rem",
                paddingBottom: "1rem",
                borderBottom:
                  i < (plan.stops?.length ?? 0) - 1 ? "1px solid var(--hairline-paper, #e0e0e0)" : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <strong>{stop.time}</strong> —{" "}
                  <span style={{ fontWeight: 600 }}>{stop.place_name}</span>
                  {stop.category && (
                    <span
                      className="reason-chip"
                      style={{ marginLeft: "0.5rem", fontSize: "0.75rem" }}
                    >
                      {stop.category}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <a
                    href={gcalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-tiny"
                    style={{ textDecoration: "none" }}
                  >
                    + Google Calendar
                  </a>
                  {stop.booking_url && (
                    <a
                      href={stop.booking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary"
                      style={{ fontSize: "0.78rem", padding: "4px 8px", textDecoration: "none" }}
                    >
                      Reserve a spot →
                    </a>
                  )}
                </div>
              </div>
              {stop.notes && (
                <p
                  style={{
                    margin: "0.25rem 0 0",
                    color: "var(--on-paper-muted)",
                    fontSize: "0.85rem",
                  }}
                >
                  {stop.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: "0.75rem", color: "var(--on-paper-muted)", marginTop: "1rem" }}>
        This is a read-only shared view. <a href="/">Create your own recommendations →</a>
      </p>
    </main>
  );
}
