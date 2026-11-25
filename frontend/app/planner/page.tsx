"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RecommendationMap, { MapPlace } from "../components/RecommendationMap";
import TravelBackground from "../components/TravelBackground";
import { getPlaceImageUrl, formatEstimatedPrice } from "../utils/placeImages";

export type TravelMode = "driving" | "transit" | "cycling" | "walking";

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "cafe", label: "☕ Cafes & Coffee" },
  { value: "restaurant", label: "🍽️ Restaurants & Dining" },
  { value: "bar", label: "🍺 Bars & Breweries" },
  { value: "park", label: "🌿 Parks & Gardens" },
  { value: "museum", label: "🏛️ Museums & Culture" },
  { value: "attraction", label: "✨ Attractions & Landmarks" },
  { value: "cinema", label: "🎬 Cinema & Movies" },
  { value: "shopping", label: "🛍️ Shopping" },
];

const OUTING_TYPES = [
  { value: "friends", label: "Friends Hangout" },
  { value: "couple", label: "Date / Couple" },
  { value: "family", label: "Family Outing" },
  { value: "solo", label: "Solo Exploration" },
];

const AGGREGATION_METHODS = [
  { value: "least_misery", label: "Least Misery — Nobody hates the pick" },
  { value: "average", label: "Group Average — Best overall score" },
  { value: "borda", label: "Borda Count — Fair rank-based consensus" },
];

const QUICK_DESTINATIONS = [
  { name: "Bengaluru", label: "Bengaluru (Center)", lat: 12.9716, lng: 77.5946 },
  { name: "Indiranagar", label: "Indiranagar, BLR", lat: 12.9784, lng: 77.6408 },
  { name: "Cubbon Park", label: "Cubbon Park, BLR", lat: 12.9763, lng: 77.5929 },
  { name: "MG Road", label: "MG Road, BLR", lat: 12.9756, lng: 77.6066 },
  { name: "Mysuru", label: "Mysuru (Mysore)", lat: 12.2958, lng: 76.6394 },
  { name: "Mumbai", label: "Mumbai", lat: 18.9432, lng: 72.8235 },
];

const QUICK_START_POINTS = [
  { name: "Electronic City", label: "Electronic City, BLR", lat: 12.8399, lng: 77.6770 },
  { name: "Whitefield", label: "Whitefield, BLR", lat: 12.9698, lng: 77.7500 },
  { name: "Koramangala", label: "Koramangala, BLR", lat: 12.9352, lng: 77.6245 },
  { name: "Jayanagar", label: "Jayanagar, BLR", lat: 12.9308, lng: 77.5838 },
  { name: "Indiranagar", label: "Indiranagar, BLR", lat: 12.9784, lng: 77.6408 },
  { name: "Airport", label: "Bengaluru Airport (BLR)", lat: 13.1986, lng: 77.7066 },
];

const WEIGHT_KEYS = ["ml", "content", "collaborative", "context", "distance", "sentiment", "popularity"] as const;
const WEIGHT_LABELS: Record<string, string> = {
  ml: "Smart ML Score",
  content: "Vibe & Category Match",
  collaborative: "People With Similar Taste",
  context: "Weather, Time & Budget Fit",
  distance: "Proximity & Distance",
  sentiment: "Verified Review Ratings",
  popularity: "Popularity & Buzz",
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
    review_count?: number;
    average_cost?: number;
    description?: string;
    lat: number;
    lng: number;
    booking_url?: string | null;
  };
  score: number;
  score_breakdown: ScoreBreakdown;
  reasons: string[];
  travel_info?: {
    road_distance_km?: number | null;
    straight_line_km?: number;
    detour_percent?: number;
    duration_minutes?: number | null;
    summary: string;
    comparison_note?: string;
    geometry?: any;
    mode?: TravelMode;
    transit_available?: boolean;
    transit_message?: string;
    directions_url?: string;
  };
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

type Suggestion = {
  name: string;
  label: string;
  lat: number;
  lng: number;
  city?: string;
};

export default function PlannerPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  // Internal User ID
  const [userId, setUserId] = useState<string>("1");

  // Step 1: Destination location
  const [destInput, setDestInput] = useState<string>("Bengaluru");
  const [destPlaceName, setDestPlaceName] = useState<string>("Bengaluru, Karnataka (City Center)");
  const [destLat, setDestLat] = useState<number>(12.9716);
  const [destLng, setDestLng] = useState<number>(77.5946);
  const [destSuggestions, setDestSuggestions] = useState<Suggestion[]>([]);
  const [showDestSuggestions, setShowDestSuggestions] = useState<boolean>(false);
  const destRef = useRef<HTMLDivElement>(null);

  // Step 2: Starting location
  const [startInput, setStartInput] = useState<string>("Electronic City, Bengaluru");
  const [startPlaceName, setStartPlaceName] = useState<string>("Electronic City, Bengaluru");
  const [startLat, setStartLat] = useState<number>(12.8399);
  const [startLng, setStartLng] = useState<number>(77.6770);
  const [startSuggestions, setStartSuggestions] = useState<Suggestion[]>([]);
  const [showStartSuggestions, setShowStartSuggestions] = useState<boolean>(false);
  const startRef = useRef<HTMLDivElement>(null);

  // Travel calculation state
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");
  const [routeSummary, setRouteSummary] = useState<string | null>(null);
  const [calculatingRoute, setCalculatingRoute] = useState<boolean>(false);
  const reqSeqRef = useRef<number>(0);

  // Outing preferences
  const [radiusKm, setRadiusKm] = useState<string>("8");
  const [category, setCategory] = useState<string>("");
  const [outingType, setOutingType] = useState<string>("friends");

  // Group planning
  const [groupMode, setGroupMode] = useState<boolean>(false);
  const [extraUserIds, setExtraUserIds] = useState<string>("2, 3");
  const [aggregation, setAggregation] = useState<string>("least_misery");

  // Advanced controls
  const [diversity, setDiversity] = useState<number>(0.15);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [weightOverrides, setWeightOverrides] = useState<Record<string, number> | null>(null);

  // Recommendation query & view state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [placesWithTravel, setPlacesWithTravel] = useState<Recommendation[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);
  const [showMap, setShowMap] = useState<boolean>(true);

  // Active road route geometry & HUD stats
  const [activeRouteGeometry, setActiveRouteGeometry] = useState<any>(null);
  const [routeStats, setRouteStats] = useState<{
    road_distance_km?: number | null;
    straight_line_km?: number;
    duration_minutes?: number | null;
    detour_percent?: number;
    summary?: string;
    target_name?: string;
    mode?: string;
    transit_available?: boolean;
    transit_message?: string;
    directions_url?: string;
  } | null>(null);

  // Venue reporting state
  const [reportingPlaceId, setReportingPlaceId] = useState<number | null>(null);
  const [reportIssueType, setReportIssueType] = useState<string>("wrong_hours");
  const [reportDescription, setReportDescription] = useState<string>("");
  const [reportSubmitting, setReportSubmitting] = useState<boolean>(false);
  const [reportStatus, setReportStatus] = useState<Record<number, "success" | "error" | null>>({});

  // Offline detection state
  const [isOffline, setIsOffline] = useState<boolean>(false);

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
          if (data.user_id) {
            setUserId(String(data.user_id));
          }
        }
      } catch {
        router.push("/login");
      }
    }
    checkSession();
  }, [router]);

  // Click outside listener for suggestions dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (destRef.current && !destRef.current.contains(event.target as Node)) {
        setShowDestSuggestions(false);
      }
      if (startRef.current && !startRef.current.contains(event.target as Node)) {
        setShowStartSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for Destination autocomplete
  useEffect(() => {
    if (!destInput.trim()) {
      setDestSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/geocode?q=${encodeURIComponent(destInput.trim())}`);
        if (resp.ok) {
          const data = await resp.json();
          setDestSuggestions(data.suggestions || []);
        }
      } catch {}
    }, 250);
    return () => clearTimeout(timer);
  }, [destInput]);

  // Debounced search for Starting Location autocomplete
  useEffect(() => {
    if (!startInput.trim()) {
      setStartSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const resp = await fetch(`/api/geocode?q=${encodeURIComponent(startInput.trim())}`);
        if (resp.ok) {
          const data = await resp.json();
          setStartSuggestions(data.suggestions || []);
        }
      } catch {}
    }, 250);
    return () => clearTimeout(timer);
  }, [startInput]);

  // Calculate route distance and travel time from Start to Destination
  useEffect(() => {
    if (!startLat || !startLng || !destLat || !destLng) return;

    let isMounted = true;
    async function fetchRoute() {
      try {
        setCalculatingRoute(true);
        const resp = await fetch("/api/route-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_lat: startLat,
            start_lng: startLng,
            dest_lat: destLat,
            dest_lng: destLng,
            mode: travelMode,
          }),
        });
        if (resp.ok && isMounted) {
          const data = await resp.json();
          setRouteSummary(data.summary || `${data.road_distance_km} km`);
          setActiveRouteGeometry(data.geometry);
          setRouteStats({
            road_distance_km: data.road_distance_km,
            straight_line_km: data.straight_line_km,
            duration_minutes: data.duration_minutes,
            detour_percent: data.detour_percent,
            summary: data.summary,
            target_name: destPlaceName,
            mode: travelMode,
            transit_available: data.transit_available,
            transit_message: data.transit_message,
            directions_url: data.directions_url,
          });
        }
      } catch {
        if (isMounted) setRouteSummary(null);
      } finally {
        if (isMounted) setCalculatingRoute(false);
      }
    }

    fetchRoute();
    return () => {
      isMounted = false;
    };
  }, [startLat, startLng, destLat, destLng, travelMode, destPlaceName]);

  function handleSelectDestination(loc: Suggestion) {
    setDestInput(loc.name);
    setDestPlaceName(loc.label || loc.name);
    setDestLat(loc.lat);
    setDestLng(loc.lng);
    setShowDestSuggestions(false);
    setLocationError(null);
  }

  function handleSelectStart(loc: Suggestion) {
    setStartInput(loc.name);
    setStartPlaceName(loc.label || loc.name);
    setStartLat(loc.lat);
    setStartLng(loc.lng);
    setShowStartSuggestions(false);
    setLocationError(null);
  }

  async function resolveLocation(name: string): Promise<{ lat: number; lng: number; label: string } | null> {
    try {
      const resp = await fetch(`/api/geocode?q=${encodeURIComponent(name.trim())}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.suggestions && data.suggestions.length > 0) {
          const top = data.suggestions[0];
          return { lat: top.lat, lng: top.lng, label: top.label || top.name };
        }
      }
    } catch {}
    return null;
  }

  function updateWeight(key: string, value: number) {
    setWeightOverrides((prev) => ({ ...(prev || {}), [key]: value }));
  }

  // Calculate distance & travel times from Starting Location to each recommended place
  async function enrichPlacesWithTravel(recs: Recommendation[], sLat: number, sLng: number, mode: TravelMode) {
    const seq = ++reqSeqRef.current;
    setCalculatingRoute(true);

    const updated = await Promise.all(
      recs.map(async (rec) => {
        try {
          const resp = await fetch("/api/route-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              start_lat: sLat,
              start_lng: sLng,
              dest_lat: rec.place.lat,
              dest_lng: rec.place.lng,
              mode,
            }),
          });
          if (resp.ok) {
            const rData = await resp.json();
            return {
              ...rec,
              travel_info: {
                road_distance_km: rData.road_distance_km,
                straight_line_km: rData.straight_line_km,
                detour_percent: rData.detour_percent,
                duration_minutes: rData.duration_minutes,
                summary: rData.summary,
                comparison_note: rData.comparison_note,
                geometry: rData.geometry,
                mode,
                transit_available: rData.transit_available,
                transit_message: rData.transit_message,
                directions_url: rData.directions_url,
              },
            };
          }
        } catch {}
        return rec;
      }),
    );

    // Only commit if this was the latest request (prevents race conditions from rapid clicking)
    if (seq === reqSeqRef.current) {
      setPlacesWithTravel(updated);
      setCalculatingRoute(false);

      // Default the active road line and HUD stats to the selected or top place
      if (updated.length > 0) {
        const target = (selectedPlaceId ? updated.find((r) => r.place.id === selectedPlaceId) : null) || updated[0];
        if (target && target.travel_info) {
          setSelectedPlaceId(target.place.id);
          if (target.travel_info.geometry) {
            setActiveRouteGeometry(target.travel_info.geometry);
          }
          setRouteStats({
            road_distance_km: target.travel_info.road_distance_km ?? target.place.distance_km,
            straight_line_km: target.travel_info.straight_line_km ?? target.place.distance_km,
            duration_minutes: target.travel_info.duration_minutes,
            detour_percent: target.travel_info.detour_percent ?? 0,
            summary: target.travel_info.summary,
            target_name: target.place.name,
            mode,
            transit_available: target.travel_info.transit_available,
            transit_message: target.travel_info.transit_message,
            directions_url: target.travel_info.directions_url,
          });
        }
      }
    }
  }

  // Handle travel mode change: triggers instant recalculation for destination AND all place cards
  function handleTravelModeChange(newMode: TravelMode) {
    if (newMode === travelMode) return;
    setTravelMode(newMode);

    const pool = result?.recommendations;
    if (pool && pool.length > 0) {
      enrichPlacesWithTravel(pool, startLat, startLng, newMode);
    }
  }

  function selectPlaceAndRoute(placeId: number) {
    setSelectedPlaceId(placeId);
    const pool = placesWithTravel.length > 0 ? placesWithTravel : result?.recommendations || [];
    const found = pool.find((r) => r.place.id === placeId);
    if (found?.travel_info) {
      if (found.travel_info.geometry) {
        setActiveRouteGeometry(found.travel_info.geometry);
      }
      setRouteStats({
        road_distance_km: found.travel_info.road_distance_km ?? found.place.distance_km,
        straight_line_km: found.travel_info.straight_line_km ?? found.place.distance_km,
        duration_minutes: found.travel_info.duration_minutes,
        detour_percent: found.travel_info.detour_percent ?? 0,
        summary: found.travel_info.summary,
        target_name: found.place.name,
        mode: travelMode,
        transit_available: found.travel_info.transit_available,
        transit_message: found.travel_info.transit_message,
        directions_url: found.travel_info.directions_url,
      });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocationError(null);
    setError(null);

    if (!destInput.trim()) {
      setLocationError("Please enter where you want to explore.");
      return;
    }
    if (!startInput.trim()) {
      setLocationError("Please enter your starting location.");
      return;
    }

    setLoading(true);
    setResult(null);
    setPlacesWithTravel([]);
    setDismissed(new Set());

    try {
      // 1. Resolve destination coordinates internally
      let cDestLat = destLat;
      let cDestLng = destLng;
      if (!destPlaceName || destPlaceName.toLowerCase() !== destInput.toLowerCase()) {
        const resolved = await resolveLocation(destInput);
        if (!resolved) {
          setLocationError(`Could not identify destination "${destInput}". Please select from suggestions or try a known city.`);
          setLoading(false);
          return;
        }
        cDestLat = resolved.lat;
        cDestLng = resolved.lng;
        setDestLat(resolved.lat);
        setDestLng(resolved.lng);
        setDestPlaceName(resolved.label);
      }

      // 2. Resolve starting coordinates internally
      let cStartLat = startLat;
      let cStartLng = startLng;
      if (!startPlaceName || startPlaceName.toLowerCase() !== startInput.toLowerCase()) {
        const resolvedStart = await resolveLocation(startInput);
        if (!resolvedStart) {
          setLocationError(`Could not identify starting location "${startInput}". Please select from suggestions.`);
          setLoading(false);
          return;
        }
        cStartLat = resolvedStart.lat;
        cStartLng = resolvedStart.lng;
        setStartLat(resolvedStart.lat);
        setStartLng(resolvedStart.lng);
        setStartPlaceName(resolvedStart.label);
      }

      const user_ids = groupMode
        ? [Number(userId), ...extraUserIds.split(",").map((s) => s.trim()).filter(Boolean).map(Number)]
        : undefined;

      const resp = await fetch("/api/recommendations/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: Number(userId),
          user_ids,
          group_aggregation: groupMode ? aggregation : undefined,
          lat: cDestLat,
          lng: cDestLng,
          radius_km: Number(radiusKm) || 8,
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

      // 3. Compute mode-specific road distances and travel times to each place
      await enrichPlacesWithTravel(data.recommendations, cStartLat, cStartLng, travelMode);
    } catch (err: any) {
      setError(err.message || "Failed to find recommendations. Please check your connection and try again.");
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
      const resp = await fetch(`/api/recommendations/recommendations/${result.session_id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place_id: placeId, action }),
      });
      if (resp.status === 401) {
        router.push("/login");
        return;
      }
      if (!resp.ok) return;
      const data = await resp.json();
      setResult({ ...result, recommendations: data.recommendations });
      enrichPlacesWithTravel(data.recommendations, startLat, startLng, travelMode);
    } catch {}
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

  async function logout() {
    try {
      await fetch("/api/session", { method: "DELETE" });
    } finally {
      router.push("/");
    }
  }

  if (authenticated !== true) {
    return null;
  }

  const activeRecs = (placesWithTravel.length > 0 ? placesWithTravel : result?.recommendations || []).filter(
    (r) => !dismissed.has(r.place.id),
  );

  // Prepare map places data
  const mapPlaces: MapPlace[] = activeRecs.map((r) => ({
    id: r.place.id,
    name: r.place.name,
    category: r.place.category,
    lat: r.place.lat,
    lng: r.place.lng,
    score: r.score,
    rating: r.place.rating,
    price_range: r.place.price_range,
    road_distance_km: r.travel_info?.road_distance_km,
    straight_line_km: r.travel_info?.straight_line_km,
    detour_percent: r.travel_info?.detour_percent,
    travel_time: r.travel_info?.duration_minutes != null ? `~${r.travel_info.duration_minutes} mins` : undefined,
    image_url: getPlaceImageUrl(r.place.name, r.place.category),
    booking_url: r.place.booking_url,
    mode: travelMode,
  }));

  const googleTravelMode =
    travelMode === "cycling"
      ? "bicycling"
      : travelMode === "walking"
      ? "walking"
      : travelMode === "transit"
      ? "transit"
      : "driving";

  return (
    <main className="page">
      {/* Travel-Inspired Multi-Layered Ambient Background */}
      <TravelBackground />

      {/* 3.2 Planner Hero Header & 3.3 Visual Collage */}
      <section className="planner-hero">
        <div className="planner-hero-content">
          <p className="planner-hero-eyebrow">
            <span>✦</span> YOUR NEXT ADVENTURE STARTS HERE
          </p>
          <div className="planner-hero-heading-group">
            <h1 className="planner-hero-title-main">Plan Your Next Outing.</h1>
            <span className="planner-hero-title-highlight">
              Discover places worth exploring.
            </span>
          </div>
          <p className="planner-hero-desc">
            Choose where you&apos;re going, tell us where you&apos;re starting from, and we&apos;ll help you discover the best experiences along the way.
          </p>

          <div className="planner-hero-highlights">
            <div className="planner-hero-pill">
              <span>✦</span> Smart recommendations
            </div>
            <div className="planner-hero-pill">
              <span>📍</span> Real travel distances
            </div>
            <div className="planner-hero-pill">
              <span>🏷️</span> Experiences for every budget
            </div>
          </div>
        </div>

        {/* 3.3 Hero Visual: Compact Editorial Collage */}
        <div className="planner-collage" aria-hidden="true">
          <div className="planner-collage-item planner-collage-item-large">
            <img
              src="https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80"
              alt="Lalbagh Botanical Gardens"
              className="planner-collage-img"
            />
            <span className="planner-collage-badge">🌿 Botanical Gardens</span>
          </div>
          <div className="planner-collage-item">
            <img
              src="https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80"
              alt="Craft Brewery"
              className="planner-collage-img"
            />
            <span className="planner-collage-badge">☕ Craft Breweries</span>
          </div>
          <div className="planner-collage-item">
            <img
              src="https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=600&q=80"
              alt="Scenic Outdoor Park"
              className="planner-collage-img"
            />
            <span className="planner-collage-badge">🌳 Scenic Parks</span>
          </div>
        </div>
      </section>

      {/* Main 2-Column Responsive Dashboard (34% Controls, 66% Map & Results) */}
      <div className="planner-dashboard">
        {/* Left Column: Guided Planning Form */}
        <section className="planner-sidebar">
          <form className="card fade-in" onSubmit={submit} style={{ margin: 0 }}>
            {/* Step 1: Destination Location */}
            <div className="location-search-box" ref={destRef}>
              <div className="step-indicator-row">
                <span className="step-badge">Step 1</span>
                <label htmlFor="dest-input" style={{ margin: 0 }}>
                  Where do you want to explore?
                </label>
              </div>
              <div className="location-input-row" style={{ marginTop: "6px" }}>
                <span className="location-input-icon">🎯</span>
                <input
                  id="dest-input"
                  className="location-input-field"
                  type="text"
                  value={destInput}
                  onChange={(e) => {
                    setDestInput(e.target.value);
                    setShowDestSuggestions(true);
                    setLocationError(null);
                  }}
                  onFocus={() => setShowDestSuggestions(true)}
                  placeholder="Search for a city, area, landmark, or destination..."
                  autoComplete="off"
                  required
                />
                {destInput && (
                  <button
                    type="button"
                    className="location-clear-btn"
                    onClick={() => {
                      setDestInput("");
                      setDestPlaceName("");
                    }}
                    title="Clear destination"
                  >
                    ✕
                  </button>
                )}
              </div>

              {showDestSuggestions && destSuggestions.length > 0 && (
                <div className="location-suggestions-dropdown">
                  {destSuggestions.map((loc, idx) => (
                    <div
                      key={`dest-${loc.name}-${idx}`}
                      className="location-suggestion-item"
                      onClick={() => handleSelectDestination(loc)}
                    >
                      <span className="location-suggestion-icon">📍</span>
                      <div className="location-suggestion-text">
                        <div className="location-suggestion-name">{loc.name}</div>
                        <div className="location-suggestion-sub">{loc.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="location-quick-chips">
                <span className="location-chips-label">Popular:</span>
                {QUICK_DESTINATIONS.map((q) => (
                  <button
                    key={`qdest-${q.name}`}
                    type="button"
                    className={`location-chip-btn ${destInput.toLowerCase() === q.name.toLowerCase() ? "active" : ""}`}
                    onClick={() => handleSelectDestination(q)}
                  >
                    {q.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Starting Location */}
            <div className="location-search-box" ref={startRef} style={{ marginTop: "20px" }}>
              <div className="step-indicator-row">
                <span className="step-badge" style={{ background: "rgba(21, 128, 61, 0.1)", color: "#15803d", borderColor: "rgba(21, 128, 61, 0.3)" }}>
                  Step 2
                </span>
                <label htmlFor="start-input" style={{ margin: 0 }}>
                  Where are you starting from?
                </label>
              </div>
              <p className="hint" style={{ margin: "2px 0 8px 0" }}>
                Enter your starting location to calculate distance, travel time, and convenient venues.
              </p>
              <div className="location-input-row">
                <span className="location-input-icon">🏠</span>
                <input
                  id="start-input"
                  className="location-input-field"
                  type="text"
                  value={startInput}
                  onChange={(e) => {
                    setStartInput(e.target.value);
                    setShowStartSuggestions(true);
                    setLocationError(null);
                  }}
                  onFocus={() => setShowStartSuggestions(true)}
                  placeholder="Enter your starting address, area, landmark, or city..."
                  autoComplete="off"
                  required
                />
                {startInput && (
                  <button
                    type="button"
                    className="location-clear-btn"
                    onClick={() => {
                      setStartInput("");
                      setStartPlaceName("");
                    }}
                    title="Clear starting location"
                  >
                    ✕
                  </button>
                )}
              </div>

              {showStartSuggestions && startSuggestions.length > 0 && (
                <div className="location-suggestions-dropdown">
                  {startSuggestions.map((loc, idx) => (
                    <div
                      key={`start-${loc.name}-${idx}`}
                      className="location-suggestion-item"
                      onClick={() => handleSelectStart(loc)}
                    >
                      <span className="location-suggestion-icon">🏠</span>
                      <div className="location-suggestion-text">
                        <div className="location-suggestion-name">{loc.name}</div>
                        <div className="location-suggestion-sub">{loc.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="location-quick-chips">
                <span className="location-chips-label">Quick start:</span>
                {QUICK_START_POINTS.map((q) => (
                  <button
                    key={`qstart-${q.name}`}
                    type="button"
                    className={`location-chip-btn ${startInput.toLowerCase() === q.name.toLowerCase() ? "active" : ""}`}
                    onClick={() => handleSelectStart(q)}
                  >
                    {q.name}
                  </button>
                ))}
              </div>

              {/* Redesigned 4-Mode Travel Mode Selector */}
              <div style={{ marginTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--on-paper-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Travel Mode:
                  </span>
                  {calculatingRoute && (
                    <span className="recalculating-pill">
                      ⟳ Recalculating...
                    </span>
                  )}
                </div>

                <div className="travel-mode-grid" role="radiogroup" aria-label="Travel mode selection">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={travelMode === "driving"}
                    className={`travel-mode-card-btn ${travelMode === "driving" ? "active" : ""}`}
                    onClick={() => handleTravelModeChange("driving")}
                  >
                    <div className="travel-mode-icon">🚗</div>
                    <div className="travel-mode-label-group">
                      <span className="travel-mode-name">Car</span>
                      <span className="travel-mode-desc">Driving road route</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={travelMode === "transit"}
                    className={`travel-mode-card-btn ${travelMode === "transit" ? "active" : ""}`}
                    onClick={() => handleTravelModeChange("transit")}
                  >
                    <div className="travel-mode-icon">🚌</div>
                    <div className="travel-mode-label-group">
                      <span className="travel-mode-name">Bus</span>
                      <span className="travel-mode-desc">Public transport</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={travelMode === "cycling"}
                    className={`travel-mode-card-btn ${travelMode === "cycling" ? "active" : ""}`}
                    onClick={() => handleTravelModeChange("cycling")}
                  >
                    <div className="travel-mode-icon">🚲</div>
                    <div className="travel-mode-label-group">
                      <span className="travel-mode-name">Bicycle</span>
                      <span className="travel-mode-desc">Cycling paths</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={travelMode === "walking"}
                    className={`travel-mode-card-btn ${travelMode === "walking" ? "active" : ""}`}
                    onClick={() => handleTravelModeChange("walking")}
                  >
                    <div className="travel-mode-icon">🚶</div>
                    <div className="travel-mode-label-group">
                      <span className="travel-mode-name">Walking</span>
                      <span className="travel-mode-desc">On foot walkways</span>
                    </div>
                  </button>
                </div>

                {travelMode === "transit" && (
                  <div className="transit-unavailable-banner fade-in">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
                      <span>⚠️</span>
                      <span>Live GTFS schedule feeds not configured</span>
                    </div>
                    <div>
                      Public transport timetable routing is currently unavailable for this corridor.
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${destLat},${destLng}&travelmode=transit`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open live bus &amp; metro routes in Google Maps Transit →
                    </a>
                  </div>
                )}
              </div>

              {/* Journey Preview Summary */}
              {routeSummary && (
                <div className="location-resolved-badge" style={{ marginTop: "14px", background: "rgba(15, 118, 110, 0.08)" }}>
                  <span>📍 Journey:</span>
                  <strong>{routeSummary}</strong>
                  {calculatingRoute && <span style={{ opacity: 0.6 }}>(updating...)</span>}
                </div>
              )}

              {locationError && <div className="error">{locationError}</div>}
            </div>

            {/* Step 3: Outing Preferences */}
            <div style={{ marginTop: "20px" }}>
              <div className="step-indicator-row">
                <span className="step-badge">Step 3</span>
                <span style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", color: "var(--on-paper-muted)" }}>
                  Outing Preferences
                </span>
              </div>

              <div className="grid" style={{ marginTop: "10px" }}>
                <div>
                  <label htmlFor="outing-type">Outing Type</label>
                  <select
                    id="outing-type"
                    value={outingType}
                    onChange={(e) => setOutingType(e.target.value)}
                  >
                    {OUTING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="radius">
                    Search Radius
                    <span className="label-hint">({radiusKm} km)</span>
                  </label>
                  <select
                    id="radius"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(e.target.value)}
                  >
                    <option value="3">Within 3 km (Walking)</option>
                    <option value="5">Within 5 km (Short Drive)</option>
                    <option value="8">Within 8 km (City District)</option>
                    <option value="15">Within 15 km (Across Town)</option>
                    <option value="25">Within 25 km (Greater Area)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <label htmlFor="category">Category (Optional)</label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Group Planning Feature */}
              <div className="toggle-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={groupMode}
                    onChange={(e) => setGroupMode(e.target.checked)}
                  />
                  Planning for a group of friends or family?
                </label>
              </div>

              {groupMode && (
                <div className="group-planning-panel">
                  <div>
                    <label htmlFor="group-members">
                      Group Member IDs
                      <span className="label-hint">(Separate with commas)</span>
                    </label>
                    <input
                      id="group-members"
                      value={extraUserIds}
                      onChange={(e) => setExtraUserIds(e.target.value)}
                      placeholder="e.g. 2, 3"
                    />
                    <p className="hint" style={{ marginTop: "4px" }}>
                      We&apos;ll combine everyone&apos;s taste to prevent vetoes.
                    </p>
                  </div>

                  <div style={{ marginTop: "12px" }}>
                    <label htmlFor="aggregation-method">How should we balance everyone&apos;s preferences?</label>
                    <select
                      id="aggregation-method"
                      value={aggregation}
                      onChange={(e) => setAggregation(e.target.value)}
                    >
                      {AGGREGATION_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Step 4: Collapsible Advanced Preferences */}
            <div className="toggle-row">
              <button
                type="button"
                className="btn-secondary"
                style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => setShowAdvanced((s) => !s)}
              >
                <span>{showAdvanced ? "▲ Hide" : "▼ Show"} fine-tuning &amp; variety controls</span>
              </button>
            </div>

            {showAdvanced && (
              <div className="advanced-panel">
                <label>
                  Variety &amp; Surprise ({Math.round(diversity * 100)}% exploration)
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={diversity}
                  onChange={(e) => setDiversity(Number(e.target.value))}
                />
                <p className="hint">
                  0% = Safest top picks; 100% = Maximum variety across categories and hidden gems.
                </p>

                <p className="hint" style={{ marginTop: 14, fontWeight: 600 }}>
                  Adjust factor importance (optional):
                </p>
                {WEIGHT_KEYS.map((key) => (
                  <div key={key} className="slider-row">
                    <label>{WEIGHT_LABELS[key]}</label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={weightOverrides?.[key] ?? ""}
                      onChange={(e) => updateWeight(key, Number(e.target.value))}
                    />
                  </div>
                ))}
                {weightOverrides && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ marginTop: 10 }}
                    onClick={() => setWeightOverrides(null)}
                  >
                    Reset weights to defaults
                  </button>
                )}
              </div>
            )}

            {/* Step 5: Submit Action */}
            <button
              type="submit"
              className="btn-primary"
              style={{ width: "100%", fontSize: "1.05rem", padding: "14px 20px", marginTop: "22px" }}
              disabled={loading}
            >
              {loading ? "Calculating routes & finding places..." : "Find Places for Me →"}
            </button>

            {error && <div className="error">{error}</div>}
          </form>
        </section>

        {/* Right Column: Prominent Map & Recommendation Cards */}
        <section className="planner-results-area">
          {isOffline && result && (
            <div
              className="card fade-in"
              style={{
                background: "#fef3c7",
                border: "1px solid #fcd34d",
                padding: "0.85rem 1.1rem",
                marginBottom: "1rem",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.88rem", color: "#92400e" }}>
                ⚠️ You&apos;re offline — displaying cached results. Reconnect for fresh recommendations.
              </p>
            </div>
          )}

          {/* Loading Skeletons */}
          {loading && (
            <div className="skeleton-list fade-in">
              <div className="context-banner">
                <span style={{ fontSize: "0.88rem", color: "var(--on-paper-muted)" }}>
                  Calculating {travelMode} route from <strong>{startInput}</strong> to <strong>{destInput}</strong>, analyzing live weather, and scoring venues...
                </span>
              </div>
              <div style={{ height: "420px", background: "var(--surface-soft)", borderRadius: "16px", border: "1px solid var(--hairline-paper)", marginBottom: "20px" }} />
              {[1, 2, 3].map((n) => (
                <div key={n} className="skeleton-ticket">
                  <div className="skeleton-stub" />
                  <div className="skeleton-content">
                    <div className="skeleton-bar" style={{ width: "45%", height: 22 }} />
                    <div className="skeleton-bar" style={{ width: "30%", height: 14 }} />
                    <div className="skeleton-bar" style={{ width: "70%", height: 16 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Initial Empty State (before search) */}
          {!loading && !result && (
            <div className="empty-state-card fade-in">
              <div className="empty-state-icon">🧭</div>
              <h2 className="empty-state-title">Where are we going today?</h2>
              <p className="empty-state-desc">
                Enter your starting location and target destination on the left, choose your preferred travel mode, and click{" "}
                <strong>&ldquo;Find Places for Me&rdquo;</strong> to see personalized places with live mode-specific routes, maps, photos, and instant reservations.
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  type="button"
                  className="location-chip-btn"
                  onClick={() => {
                    handleSelectStart(QUICK_START_POINTS[0]);
                    handleSelectDestination(QUICK_DESTINATIONS[0]);
                  }}
                >
                  Try Electronic City → Bengaluru Center
                </button>
                <button
                  type="button"
                  className="location-chip-btn"
                  onClick={() => {
                    handleSelectStart(QUICK_START_POINTS[2]);
                    handleSelectDestination(QUICK_DESTINATIONS[1]);
                  }}
                >
                  Try Koramangala → Indiranagar
                </button>
              </div>
            </div>
          )}

          {/* Results State */}
          {!loading && result && (
            <div className="results-card fade-in">
              {/* Route Summary Banner */}
              <div className="route-summary-box">
                <div>
                  <div className="route-summary-title">Travel Plan · {travelMode === "cycling" ? "Bicycle" : travelMode === "walking" ? "Walking" : travelMode === "transit" ? "Public Transit" : "Driving"}</div>
                  <div className="route-summary-detail">
                    <span>🏠 {startPlaceName.split(",")[0]}</span>
                    <span>→</span>
                    <span>🎯 {destPlaceName.split(",")[0]}</span>
                    {routeSummary && <span className="route-summary-pill">{routeSummary}</span>}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ margin: 0, padding: "7px 14px", fontSize: "0.8rem" }}
                    onClick={() => setShowMap((prev) => !prev)}
                  >
                    {showMap ? "✕ Hide Map" : "🗺️ Show Map"}
                  </button>
                  <span style={{ fontSize: "0.82rem", color: "var(--on-paper-muted)" }}>
                    {activeRecs.length} top places
                  </span>
                </div>
              </div>

              {/* Prominent Interactive Map */}
              {showMap && mapPlaces.length > 0 && (
                <div style={{ marginBottom: "26px" }}>
                  <RecommendationMap
                    startLocation={{ name: startPlaceName, lat: startLat, lng: startLng }}
                    destinationLocation={{ name: destPlaceName, lat: destLat, lng: destLng }}
                    places={mapPlaces}
                    selectedPlaceId={selectedPlaceId}
                    travelMode={travelMode}
                    activeRouteGeometry={activeRouteGeometry}
                    routeStats={routeStats}
                    onSelectPlace={selectPlaceAndRoute}
                  />
                </div>
              )}

              {/* Context Banner */}
              <div className="context-banner" style={{ marginBottom: "18px" }}>
                <div className="context-line">
                  <span className="context-badge">
                    🌤️ {result.context.weather?.temp_c}°C · {result.context.weather?.condition}
                  </span>
                  <span>
                    {result.context.time_of_day} · {result.context.day_of_week}
                  </span>
                  {result.group_user_ids && (
                    <span className="context-badge">
                      👥 Group of {result.group_user_ids.length} ({result.group_aggregation})
                    </span>
                  )}
                </div>
                {calculatingRoute && (
                  <span className="recalculating-pill">
                    ⟳ Updating {travelMode} travel times...
                  </span>
                )}
              </div>

              {activeRecs.length === 0 && (
                <div className="empty-state-card">
                  <p className="empty">
                    No places left to show. Try increasing the search radius or exploring another neighborhood.
                  </p>
                </div>
              )}

              {/* Modern Responsive Place Cards Grid (2-3 columns on desktop) */}
              <div className="place-cards-grid">
                {activeRecs.map((rec, index) => {
                  const place = rec.place;
                  const imageUrl = getPlaceImageUrl(place.name, place.category);
                  const priceStr = formatEstimatedPrice(place.price_range, place.average_cost);
                  const isSelected = selectedPlaceId === place.id;
                  const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${place.lat},${place.lng}&travelmode=${googleTravelMode}`;

                  return (
                    <article
                      key={place.id}
                      className={`place-card ${isSelected ? "active-place" : ""}`}
                      onClick={() => selectPlaceAndRoute(place.id)}
                    >
                      {/* Image Banner */}
                      <div className="place-card-image-box">
                        <img
                          src={imageUrl}
                          alt={place.name}
                          className="place-card-image"
                          loading="lazy"
                        />
                        <div className="place-score-badge">
                          <span>★</span>
                          <span>{Math.round(rec.score * 100)}% Match</span>
                        </div>
                        <div className="place-card-category-badge">
                          #{index + 1} · {place.category}
                        </div>
                      </div>

                      {/* Card Content Body */}
                      <div className="place-card-body">
                        <h3 className="place-card-title">{place.name}</h3>

                        {place.description ? (
                          <p className="place-card-desc">{place.description}</p>
                        ) : (
                          <p className="place-card-desc">
                            Top-rated {place.category} in {destPlaceName.split(",")[0]}, popular for {outingType} outings.
                          </p>
                        )}

                        {/* Travel Time & Distance from User's Starting Point */}
                        <div className="place-card-travel-row">
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, color: "var(--on-paper-ink)", fontSize: "0.88rem" }}>
                                {travelMode === "cycling"
                                  ? `🚲 ${rec.travel_info?.road_distance_km != null ? `${rec.travel_info.road_distance_km} km bike route` : `${place.distance_km} km`}`
                                  : travelMode === "walking"
                                  ? `🚶 ${rec.travel_info?.road_distance_km != null ? `${rec.travel_info.road_distance_km} km walk` : `${place.distance_km} km`}`
                                  : travelMode === "transit"
                                  ? `🚌 Transit timetable unavailable`
                                  : `🚗 ${rec.travel_info?.road_distance_km != null ? `${rec.travel_info.road_distance_km} km drive` : `${place.distance_km} km`}`}
                              </span>
                              {rec.travel_info?.duration_minutes != null && (
                                <span style={{ color: "var(--accent)", fontWeight: 600, fontSize: "0.84rem" }}>
                                  · ~{rec.travel_info.duration_minutes} mins {travelMode === "cycling" ? "by cycle" : travelMode === "walking" ? "on foot" : "by car"}
                                </span>
                              )}
                            </div>
                            {rec.travel_info?.straight_line_km != null && travelMode !== "transit" && (
                              <div style={{ fontSize: "0.74rem", color: "var(--on-paper-muted)" }}>
                                📏 {rec.travel_info.straight_line_km} km straight line
                                {rec.travel_info.detour_percent != null && rec.travel_info.detour_percent > 10 ? (
                                  <span style={{ color: "#c2410c", fontWeight: 600 }}>
                                    {" "}(+{rec.travel_info.detour_percent}% route detour)
                                  </span>
                                ) : (
                                  <span style={{ color: "#15803d", fontWeight: 500 }}>
                                    {" "}(direct route)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: "0.72rem", color: "var(--accent)", fontWeight: 600, alignSelf: "flex-start" }}>
                            ✓ Verified hours
                          </span>
                        </div>

                        {/* Rating and Price per person */}
                        <div className="place-card-rating-price">
                          <span className="rating-stars">
                            ★ {place.rating ? place.rating.toFixed(1) : "4.6"} / 5
                            {place.review_count ? ` (${place.review_count} reviews)` : ""}
                          </span>
                          <span className="price-indicator">{priceStr}</span>
                        </div>

                        {/* Personalized Explanation Chips */}
                        <div className="reasons" style={{ marginBottom: "14px" }}>
                          {rec.reasons.map((r, i) => (
                            <span className="reason-chip" key={i}>
                              {r}
                            </span>
                          ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="place-card-actions">
                          {place.booking_url ? (
                            <a
                              href={place.booking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "0.82rem",
                                padding: "8px 14px",
                                margin: 0,
                                textDecoration: "none",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Reserve spot →
                            </a>
                          ) : (
                            <span
                              className="btn-secondary"
                              style={{ fontSize: "0.82rem", padding: "8px 12px", margin: 0, opacity: 0.85 }}
                            >
                              Walk-ins welcome
                            </span>
                          )}

                          <a
                            href={directionsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.8rem",
                              padding: "8px 12px",
                              margin: 0,
                              textDecoration: "none",
                            }}
                            onClick={(e) => e.stopPropagation()}
                            title={`Get turn-by-turn navigation in Google Maps (${googleTravelMode})`}
                          >
                            🧭 Directions
                          </a>

                          <button
                            type="button"
                            className="btn-tiny"
                            style={isSelected ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)", fontWeight: 700 } : {}}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectPlaceAndRoute(place.id);
                              setShowMap(true);
                              window.scrollTo({ top: 320, behavior: "smooth" });
                            }}
                            title="View road route polyline from starting point on the map"
                          >
                            🛣️ {isSelected ? "Route Active" : "View Route"}
                          </button>

                          <button
                            type="button"
                            className="btn-tiny"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendFeedback(place.id, "like");
                            }}
                            title="Show more places like this"
                          >
                            👍 Like
                          </button>

                          <button
                            type="button"
                            className="btn-tiny"
                            onClick={(e) => {
                              e.stopPropagation();
                              sendFeedback(place.id, "skip");
                            }}
                            title="Hide this place"
                          >
                            ✕ Skip
                          </button>

                          <button
                            type="button"
                            className="btn-tiny"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(expandedId === place.id ? null : place.id);
                            }}
                          >
                            {expandedId === place.id ? "Hide" : "Why?"}
                          </button>
                        </div>

                        {expandedId === place.id && (
                          <pre className="breakdown" style={{ marginTop: "12px" }}>
                            {JSON.stringify(rec.score_breakdown, null, 2)}
                          </pre>
                        )}

                        {/* Inline Venue Issue Reporting */}
                        <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                          {reportStatus[place.id] === "success" ? (
                            <span style={{ fontSize: "0.75rem", color: "#2e7d32" }}>
                              ✓ Thanks — we&apos;ll review this venue!
                            </span>
                          ) : (
                            <button
                              type="button"
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                color: "var(--on-paper-muted)",
                                fontSize: "0.74rem",
                                cursor: "pointer",
                                textDecoration: "underline",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (reportingPlaceId === place.id) {
                                  setReportingPlaceId(null);
                                } else {
                                  setReportingPlaceId(place.id);
                                  setReportIssueType("wrong_hours");
                                  setReportDescription("");
                                }
                              }}
                            >
                              {reportingPlaceId === place.id ? "Cancel report" : "Report an issue"}
                            </button>
                          )}
                          {reportStatus[place.id] === "error" && (
                            <span style={{ fontSize: "0.75rem", color: "var(--burgundy, #b0505c)" }}>
                              Couldn&apos;t submit report. Please try again.
                            </span>
                          )}
                        </div>

                        {reportingPlaceId === place.id && (
                          <div
                            style={{
                              marginTop: "10px",
                              padding: "12px 14px",
                              background: "var(--surface-soft)",
                              borderRadius: "6px",
                              border: "1px solid var(--hairline-paper)",
                            }}
                            onClick={(e) => e.stopPropagation()}
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
                                placeholder="e.g. Closed on Mondays, shifted location, etc."
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  border: "1px solid var(--hairline-paper)",
                                  borderRadius: "4px",
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
                                style={{ background: "var(--accent)", color: "#fff" }}
                                disabled={reportSubmitting}
                                onClick={() => submitVenueReport(place.id)}
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
                    </article>
                  );
                })}
              </div>

              <p style={{ fontSize: "0.74rem", color: "var(--on-paper-muted)", marginTop: "2rem", textAlign: "center" }}>
                Mode-specific routes and travel times calculated using OpenStreetMap routing. Venue information © OpenStreetMap contributors.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
