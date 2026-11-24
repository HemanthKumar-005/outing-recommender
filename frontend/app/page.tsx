"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Decommissioned: NEXT_PUBLIC_API_KEY demo-key fallback has been removed.
// API keys are stored exclusively in HttpOnly cookies and never pre-filled or exposed to client-side JS.
const DEFAULT_API_KEY = "";

const CATEGORIES = ["", "cafe", "restaurant", "bar", "museum", "park", "cinema", "shopping", "attraction"];
const OUTING_TYPES = ["friends", "couple", "family", "solo"];
const AGGREGATION_METHODS = [
  { value: "least_misery", label: "Least misery — nobody hates it" },
  { value: "average", label: "Average" },
  { value: "borda", label: "Borda — rank-based" },
];
const WEIGHT_KEYS = ["ml", "content", "collaborative", "context", "distance", "sentiment", "popularity"] as const;
const WEIGHT_LABELS: Record<string, string> = {
  ml: "ML score", content: "Content match", collaborative: "Similar guests",
  context: "Weather / time / budget fit", distance: "Distance", sentiment: "Reviews", popularity: "Popularity",
};

type ScoreBreakdown = Record<string, unknown>;

type Recommendation = {
  place: {
    id: number;
    name: string;
    category: string;
    price_range: number;
    distance_km: number;
    rating?: number;
    booking_url?: string | null;
  };
  score: number;
  score_breakdown: ScoreBreakdown;
  reasons: string[];
};

type RecommendResponse = {
  session_id: string;
  group_user_ids: number[] | null;
  group_aggregation: string | null;
  context: {
    time_of_day: string;
    day_of_week: string;
    weather: { condition: string; temp_c: number };
  };
  weight_profile: Record<string, string>;
  diversity: number;
  recommendations: Recommendation[];
};

export default function Home() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  const [userId, setUserId] = useState("1");
  const [groupMode, setGroupMode] = useState(false);
  const [extraUserIds, setExtraUserIds] = useState("2, 3");
  const [showLocationConsent, setShowLocationConsent] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [aggregation, setAggregation] = useState("least_misery");
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");
  const [radiusKm, setRadiusKm] = useState("8");
  const [category, setCategory] = useState("");
  const [outingType, setOutingType] = useState("friends");
  const [diversity, setDiversity] = useState(0.15);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [weightOverrides, setWeightOverrides] = useState<Record<string, number> | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  // Venue reporting state
  const [reportingPlaceId, setReportingPlaceId] = useState<number | null>(null);
  const [reportIssueType, setReportIssueType] = useState<string>("wrong_hours");
  const [reportDescription, setReportDescription] = useState<string>("");
  const [reportSubmitting, setReportSubmitting] = useState<boolean>(false);
  const [reportStatus, setReportStatus] = useState<Record<number, "success" | "error" | null>>({});

  // Offline detection state
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Verified session check: if not authenticated, redirect to /login
  useEffect(() => {
    async function checkSession() {
      try {
        const resp = await fetch("/api/session");
        const data = await resp.json();
        if (!data.authenticated) {
          router.push("/login");
        } else {
          setAuthenticated(true);
        }
      } catch {
        router.push("/login");
      }
    }
    checkSession();
  }, [router]);

  function confirmLocation() {
    setShowLocationConsent(false);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLng(pos.coords.longitude.toFixed(4));
      },
      () => setError("Could not get your location"),
    );
  }

  async function deleteAccount() {
    setDeletingAccount(true);
    try {
      await fetch("/api/users/me", { method: "DELETE" });
      await fetch("/api/session", { method: "DELETE" });
      router.push("/signup");
    } catch {
      setError("Failed to delete account. Please try again.");
      setDeletingAccount(false);
    }
  }

  async function submitVenueReport(placeId: number) {
    setReportSubmitting(true);
    try {
      const resp = await fetch(`/api/places/${placeId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue_type: reportIssueType,
          description: reportDescription.trim() || undefined,
        }),
      });
      if (resp.ok) {
        setReportStatus((prev) => ({ ...prev, [placeId]: "success" }));
        setReportingPlaceId(null);
        setReportDescription("");
      } else {
        setReportStatus((prev) => ({ ...prev, [placeId]: "error" }));
      }
    } catch {
      setReportStatus((prev) => ({ ...prev, [placeId]: "error" }));
    } finally {
      setReportSubmitting(false);
    }
  }

  function updateWeight(key: string, value: number) {
    setWeightOverrides((prev) => ({ ...(prev || {}), [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setDismissed(new Set());
    try {
      const user_ids = groupMode
        ? [Number(userId), ...extraUserIds.split(",").map((s) => s.trim()).filter(Boolean).map(Number)]
        : undefined;

      // Proxied through Next.js API route; server attaches API key from HttpOnly cookie
      const resp = await fetch("/api/recommendations/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: Number(userId),
          user_ids,
          group_aggregation: groupMode ? aggregation : undefined,
          lat: Number(lat),
          lng: Number(lng),
          radius_km: Number(radiusKm),
          category: category || undefined,
          outing_type: outingType,
          diversity,
          weight_overrides: weightOverrides || undefined,
          top_k: 10,
        }),
      });
      if (resp.status === 401) {
        router.push("/login");
        return;
      }
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${resp.status})`);
      }
      const data: RecommendResponse = await resp.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function sendFeedback(placeId: number, action: "skip" | "like") {
    if (!result) return;
    if (action === "skip") {
      setDismissed((prev) => new Set(prev).add(placeId));
    }
    try {
      // Proxied through Next.js API route; server attaches API key from HttpOnly cookie
      const resp = await fetch(
        `/api/recommendations/recommendations/${result.session_id}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ place_id: placeId, action }),
        },
      );
      if (resp.status === 401) {
        router.push("/login");
        return;
      }
      if (!resp.ok) return;
      const data = await resp.json();
      setResult({ ...result, recommendations: data.recommendations });
    } catch {
      // live re-rank is best-effort; the dismissal already hid the card
    }
  }

  async function logout() {
    try {
      await fetch("/api/session", { method: "DELETE" });
    } finally {
      router.push("/login");
    }
  }

  // Prevent flash of unauthenticated content
  if (authenticated !== true) {
    return null;
  }

  const visibleRecs = result?.recommendations.filter((r) => !dismissed.has(r.place.id)) || [];

  return (
    <main className="page">
      <div className="top-row">
        <div>
          <p className="eyebrow">Nearby &amp; Co. · Outing Concierge</p>
          <h1>Where should we go tonight?</h1>
          <p className="subtitle">
            Ranked by fit, weather, budget and reviews — not just distance.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/model-card" className="btn-secondary" style={{ textDecoration: "none" }}>
            How does this rank?
          </Link>
          <button type="button" className="btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </div>

      <form className="card fade-in" onSubmit={submit}>
        <div className="grid">
          <div>
            <label>Guest ID</label>
            <input value={userId} onChange={(e) => setUserId(e.target.value)} required />
          </div>
          <div>
            <label>Outing type</label>
            <select value={outingType} onChange={(e) => setOutingType(e.target.value)}>
              {OUTING_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Latitude</label>
            <input value={lat} onChange={(e) => setLat(e.target.value)} required />
          </div>
          <div>
            <label>Longitude</label>
            <input value={lng} onChange={(e) => setLng(e.target.value)} required />
          </div>
          <div>
            <label>Radius (km)</label>
            <input value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} required />
          </div>
          <div>
            <label>Category (optional)</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c || "Any"}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="btn-secondary" onClick={() => setShowLocationConsent(true)}>
          Use my location
        </button>

        {showLocationConsent && (
          <div className="card fade-in" style={{ padding: "1rem", marginTop: "0.5rem" }}>
            <p style={{ margin: 0, fontSize: "0.9rem" }}>
              <strong>Location access</strong><br />
              We&apos;ll use your coordinates to find venues nearby. Your location is sent to our server only for this request and is not stored. This processing is covered by our <Link href="/privacy">Privacy Policy</Link>.
            </p>
            <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
              <button type="button" className="btn-primary" onClick={confirmLocation}>Allow</button>
              <button type="button" className="btn-secondary" onClick={() => setShowLocationConsent(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="toggle-row">
          <label className="checkbox-label">
            <input type="checkbox" checked={groupMode} onChange={(e) => setGroupMode(e.target.checked)} />
            Planning for a group
          </label>
        </div>
        {groupMode && (
          <div className="grid">
            <div>
              <label>Other guest IDs</label>
              <input value={extraUserIds} onChange={(e) => setExtraUserIds(e.target.value)} placeholder="2, 3" />
            </div>
            <div>
              <label>Combine everyone's taste by</label>
              <select value={aggregation} onChange={(e) => setAggregation(e.target.value)}>
                {AGGREGATION_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="toggle-row">
          <button type="button" className="btn-secondary" onClick={() => setShowAdvanced((s) => !s)}>
            {showAdvanced ? "Hide" : "Show"} advanced controls
          </button>
        </div>
        
        {showAdvanced && (
          <div className="advanced-panel">
            <label>Explore vs. exploit ({Math.round(diversity * 100)}% variety)</label>
            <input
              type="range" min={0} max={1} step={0.05} value={diversity}
              onChange={(e) => setDiversity(Number(e.target.value))}
            />
            <p className="hint">0% = safest top picks, 100% = maximize variety across categories and vibes.</p>

            <p className="hint" style={{ marginTop: 14 }}>Nudge how much each factor matters (optional):</p>
            {WEIGHT_KEYS.map((key) => (
              <div key={key} className="slider-row">
                <label>{WEIGHT_LABELS[key]}</label>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={weightOverrides?.[key] ?? ""}
                  onChange={(e) => updateWeight(key, Number(e.target.value))}
                />
              </div>
            ))}
            {weightOverrides && (
              <button type="button" className="btn-secondary" onClick={() => setWeightOverrides(null)}>
                Reset to defaults
              </button>
            )}
          </div>
        )}

        <br />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Setting the table..." : "Get recommendations"}
        </button>
        {error && <div className="error">{error}</div>}
      </form>

      {isOffline && result && (
        <div className="card fade-in" style={{ background: "#fef3c7", border: "1px solid #fcd34d", padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e" }}>
            ⚠️ You&apos;re offline — showing cached results. Reconnect for fresh recommendations.
          </p>
        </div>
      )}

      {result && (
        <div className="results-card fade-in">
          <div className="context-line">
            {result.context.time_of_day} · {result.context.day_of_week} ·{" "}
            {result.context.weather?.condition}, {result.context.weather?.temp_c}°C
            {result.group_user_ids && ` · party of ${result.group_user_ids.length} (${result.group_aggregation})`}
          </div>
          {visibleRecs.length === 0 && <p className="empty">No places left to show. Try a larger radius or fewer skips.</p>}
          {visibleRecs.map((rec) => (
            <div className="ticket" key={rec.place.id}>
              <div className="ticket-stub">
                <span className="ticket-score">{Math.round(rec.score * 100)}</span>
                <span className="ticket-score-label">match</span>
                <span className="ticket-category">{rec.place.category}</span>
              </div>
              <div className="ticket-main">
                <div className="ticket-header">
                  <span className="ticket-name">{rec.place.name}</span>
                </div>
                <div className="ticket-meta">
                  {"$".repeat(rec.place.price_range)} · {rec.place.distance_km} km away
                  {rec.place.rating ? ` · ${rec.place.rating}/5` : ""}
                </div>
                <div className="reasons">
                  {rec.reasons.map((r, i) => (
                    <span className="reason-chip" key={i}>{r}</span>
                  ))}
                </div>
                {rec.place.booking_url && (
                  <a
                    href={rec.place.booking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ display: "inline-block", fontSize: "0.82rem", marginTop: "0.5rem", textDecoration: "none" }}
                  >
                    Reserve a spot →
                  </a>
                )}
                <div className="action-row">
                  <button type="button" className="btn-tiny" onClick={() => sendFeedback(rec.place.id, "like")}>
                    More like this
                  </button>
                  <button type="button" className="btn-tiny" onClick={() => sendFeedback(rec.place.id, "skip")}>
                    Skip
                  </button>
                  <button
                    type="button" className="btn-tiny"
                    onClick={() => setExpandedId(expandedId === rec.place.id ? null : rec.place.id)}
                  >
                    {expandedId === rec.place.id ? "Hide details" : "Why this?"}
                  </button>
                </div>
                {expandedId === rec.place.id && (
                  <pre className="breakdown">{JSON.stringify(rec.score_breakdown, null, 2)}</pre>
                )}

                {/* Inline venue issue reporting */}
                <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                  {reportStatus[rec.place.id] === "success" ? (
                    <span style={{ fontSize: "0.75rem", color: "#2e7d32" }}>
                      ✓ Thanks — we&apos;ll review this venue.
                    </span>
                  ) : (
                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "var(--on-paper-muted)",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                      onClick={() => {
                        if (reportingPlaceId === rec.place.id) {
                          setReportingPlaceId(null);
                        } else {
                          setReportingPlaceId(rec.place.id);
                          setReportIssueType("wrong_hours");
                          setReportDescription("");
                        }
                      }}
                    >
                      {reportingPlaceId === rec.place.id ? "Cancel report" : "Report an issue"}
                    </button>
                  )}
                  {reportStatus[rec.place.id] === "error" && (
                    <span style={{ fontSize: "0.75rem", color: "var(--burgundy, #b0505c)" }}>
                      Couldn&apos;t submit report. Please try again.
                    </span>
                  )}
                </div>

                {reportingPlaceId === rec.place.id && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px 12px",
                      background: "var(--paper-dim, rgba(0,0,0,0.03))",
                      borderRadius: "4px",
                      border: "1px solid var(--hairline-paper, rgba(0,0,0,0.1))",
                    }}
                  >
                    <div style={{ marginBottom: "8px" }}>
                      <label style={{ fontSize: "0.7rem", marginTop: 0, marginBottom: "4px" }}>
                        Issue type
                      </label>
                      <select
                        value={reportIssueType}
                        onChange={(e) => setReportIssueType(e.target.value)}
                        style={{ fontSize: "0.82rem", padding: "6px 8px" }}
                      >
                        <option value="wrong_hours">Wrong operating hours</option>
                        <option value="wrong_price">Wrong price range</option>
                        <option value="closed_permanently">Permanently closed</option>
                        <option value="wrong_location">Wrong location / address</option>
                        <option value="other">Other issue</option>
                      </select>
                    </div>
                    <div style={{ marginBottom: "8px" }}>
                      <label style={{ fontSize: "0.7rem", marginTop: 0, marginBottom: "4px" }}>
                        Details (optional, max 280 chars)
                      </label>
                      <textarea
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                        maxLength={280}
                        rows={2}
                        placeholder="e.g. Closed on Tuesdays, moved across the street, etc."
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          border: "1px solid var(--hairline-paper)",
                          borderRadius: "3px",
                          fontSize: "0.82rem",
                          fontFamily: "var(--font-body)",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="btn-tiny"
                        style={{ background: "var(--brass-dim)", color: "#fff" }}
                        disabled={reportSubmitting}
                        onClick={() => submitVenueReport(rec.place.id)}
                      >
                        {reportSubmitting ? "Submitting..." : "Submit report"}
                      </button>
                      <button
                        type="button"
                        className="btn-tiny"
                        disabled={reportSubmitting}
                        onClick={() => setReportingPlaceId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          <p style={{ fontSize: "0.72rem", color: "var(--on-paper-muted)", marginTop: "1rem" }}>
            Venue data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, available under the <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener noreferrer">Open Database Licence</a>.
          </p>
        </div>
      )}

      <div className="card fade-in" style={{ marginTop: "2rem", border: "1px solid var(--danger, #e53935)" }}>
        <p className="eyebrow" style={{ color: "var(--danger, #e53935)" }}>Danger Zone · Privacy &amp; Data</p>
        <h3 style={{ margin: "0.5rem 0" }}>Delete Account</h3>
        <p className="hint" style={{ margin: "0 0 1rem 0" }}>
          Permanently delete your user profile, preferences, interaction history, and saved itineraries. Under India DPDP Act 2023 and GDPR Art. 17, your data is erased immediately.
        </p>
        {!showDeleteConfirm ? (
          <button
            type="button"
            className="btn-secondary"
            style={{ color: "var(--danger, #e53935)", borderColor: "var(--danger, #e53935)" }}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete my account
          </button>
        ) : (
          <div style={{ padding: "0.75rem", background: "var(--paper-subtle, rgba(0,0,0,0.03))", borderRadius: 6 }}>
            <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.85rem", color: "var(--danger, #e53935)" }}>
              <strong>This will permanently delete your account and all your data. This cannot be undone.</strong>
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                className="btn-primary"
                style={{ background: "var(--danger, #e53935)", borderColor: "var(--danger, #e53935)" }}
                disabled={deletingAccount}
                onClick={deleteAccount}
              >
                {deletingAccount ? "Deleting..." : "Yes, permanently delete"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={deletingAccount}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
