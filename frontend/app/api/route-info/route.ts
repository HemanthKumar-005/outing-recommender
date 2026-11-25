import { NextRequest, NextResponse } from "next/server";

export type TravelMode = "driving" | "transit" | "cycling" | "walking";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

// In-memory mode-aware route cache (max 200 items, 15 min TTL)
type CacheEntry = {
  timestamp: number;
  data: any;
};
const routeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCacheKey(sLat: number, sLng: number, dLat: number, dLng: number, mode: string): string {
  return `${sLat.toFixed(4)},${sLng.toFixed(4)}->${dLat.toFixed(4)},${dLng.toFixed(4)}:${mode}`;
}

async function handleRouteCalculation(params: {
  start_lat: number;
  start_lng: number;
  dest_lat: number;
  dest_lng: number;
  mode?: string;
}) {
  try {
    const { start_lat, start_lng, dest_lat, dest_lng, mode = "driving" } = params;

  if (
    isNaN(start_lat) ||
    isNaN(start_lng) ||
    isNaN(dest_lat) ||
    isNaN(dest_lng)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid coordinates (start_lat, start_lng, dest_lat, dest_lng)" },
      { status: 400 },
    );
  }

  const travelMode: TravelMode = ["driving", "transit", "cycling", "walking"].includes(mode)
    ? (mode as TravelMode)
    : "driving";

  const straightLineKm = haversineKm(start_lat, start_lng, dest_lat, dest_lng);

  // Check mode-specific cache
  const cacheKey = getCacheKey(start_lat, start_lng, dest_lat, dest_lng, travelMode);
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  // -------------------------------------------------------------------------
  // 1. Bus / Public Transport Handling
  // As per specification: Public transit routing is fundamentally different from
  // road driving. If live GTFS schedule feeds are not available, clearly indicate
  // that public transport schedule routing is currently unavailable rather than
  // displaying fabricated information.
  // -------------------------------------------------------------------------
  if (travelMode === "transit") {
    const googleTransitUrl = `https://www.google.com/maps/dir/?api=1&origin=${start_lat},${start_lng}&destination=${dest_lat},${dest_lng}&travelmode=transit`;

    const transitResult = {
      road_distance_km: null,
      straight_line_km: straightLineKm,
      detour_percent: 0,
      duration_minutes: null,
      mode: "transit",
      is_road_distance: false,
      transit_available: false,
      geometry: {
        type: "LineString",
        coordinates: [
          [start_lng, start_lat],
          [dest_lng, dest_lat],
        ],
      },
      formatted_road_distance: `${straightLineKm} km area distance`,
      formatted_duration: "Schedule unavailable",
      summary: "Public transit timetable unavailable for this corridor",
      transit_message:
        "Live GTFS schedule feeds are not configured for this corridor. Public transport timetable routing is currently unavailable.",
      transit_hint: "View live bus & metro routes directly in Google Maps Transit.",
      directions_url: googleTransitUrl,
      comparison_note: `Public transport routes unavailable · View live schedules on Google Maps`,
    };

    routeCache.set(cacheKey, { timestamp: Date.now(), data: transitResult });
    return NextResponse.json(transitResult);
  }

    // -------------------------------------------------------------------------
    // 2. Mode-Specific Routing (Car / Bicycle / Walking)
    // Uses OpenStreetMap dedicated instances:
    // - routed-car: actual driving road network with traffic rules & turn restrictions
    // - routed-bike: cycling paths, greenways, cycle-permitted streets
    // - routed-foot: pedestrian paths, walkways, stairs, and crosswalks
    // -------------------------------------------------------------------------
    let serverName = "routed-car";
    let modeLabel = "by car";
    let formattedMode = "road drive";

    if (travelMode === "cycling") {
      serverName = "routed-bike";
      modeLabel = "by cycle";
      formattedMode = "bike ride";
    } else if (travelMode === "walking") {
      serverName = "routed-foot";
      modeLabel = "on foot";
      formattedMode = "walk";
    }

    const primaryUrl = `https://routing.openstreetmap.de/${serverName}/route/v1/driving/${start_lng},${start_lat};${dest_lng},${dest_lat}?overview=full&geometries=geojson`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(primaryUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "NearbyApp-OutingPlanner/1.0 (contact: info@nearbyapp.local)",
        },
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (data.code === "Ok" && Array.isArray(data.routes) && data.routes.length > 0) {
          const route = data.routes[0];
          const roadDistKm = parseFloat((route.distance / 1000).toFixed(1));
          const durationMins = Math.max(1, Math.round(route.duration / 60));

          const detourPercent =
            straightLineKm > 0
              ? Math.max(0, Math.round(((roadDistKm - straightLineKm) / straightLineKm) * 100))
              : 0;

          const result = {
            road_distance_km: roadDistKm,
            straight_line_km: straightLineKm,
            detour_percent: detourPercent,
            duration_minutes: durationMins,
            mode: travelMode,
            is_road_distance: true,
            geometry: route.geometry,
            formatted_road_distance: `${roadDistKm} km ${formattedMode}`,
            formatted_duration: `~${durationMins} mins ${modeLabel}`,
            summary: `${roadDistKm} km · ~${durationMins} mins ${modeLabel}`,
            comparison_note:
              detourPercent > 10
                ? `${roadDistKm} km ${formattedMode} (vs ${straightLineKm} km straight line, +${detourPercent}% detour)`
                : `${roadDistKm} km ${formattedMode} · ~${durationMins} mins`,
          };

          // Cache mode result
          if (routeCache.size > 200) {
            const firstKey = routeCache.keys().next().value;
            if (firstKey) routeCache.delete(firstKey);
          }
          routeCache.set(cacheKey, { timestamp: Date.now(), data: result });
          return NextResponse.json(result);
        }
      }
    } catch {
      // Primary server error or timeout — proceed to mode-specific fallback
    }

    // -------------------------------------------------------------------------
    // 3. Fallback for Driving (OSRM Demo Cluster)
    // -------------------------------------------------------------------------
    if (travelMode === "driving") {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${start_lng},${start_lat};${dest_lng},${dest_lat}?overview=full&geometries=geojson`;

        const resp = await fetch(fallbackUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "NearbyApp-OutingPlanner/1.0 (contact: info@nearbyapp.local)",
          },
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = await resp.json();
          if (data.code === "Ok" && Array.isArray(data.routes) && data.routes.length > 0) {
            const route = data.routes[0];
            const roadDistKm = parseFloat((route.distance / 1000).toFixed(1));
            const durationMins = Math.max(1, Math.round(route.duration / 60));
            const detourPercent =
              straightLineKm > 0
                ? Math.max(0, Math.round(((roadDistKm - straightLineKm) / straightLineKm) * 100))
                : 0;

            const result = {
              road_distance_km: roadDistKm,
              straight_line_km: straightLineKm,
              detour_percent: detourPercent,
              duration_minutes: durationMins,
              mode: travelMode,
              is_road_distance: true,
              geometry: route.geometry,
              formatted_road_distance: `${roadDistKm} km road drive`,
              formatted_duration: `~${durationMins} mins by car`,
              summary: `${roadDistKm} km · ~${durationMins} mins by car`,
              comparison_note: `${roadDistKm} km road drive (vs ${straightLineKm} km straight line)`,
            };

            routeCache.set(cacheKey, { timestamp: Date.now(), data: result });
            return NextResponse.json(result);
          }
        }
      } catch {}
    }

    // -------------------------------------------------------------------------
    // 4. Mode-Specific Physical Mathematical Fallback
    // When external routing servers are unreachable, apply genuine mode physics:
    // - Driving: avg 28 km/h urban speed, 1.35x circuity
    // - Cycling: avg 13 km/h bicycle speed, 1.25x circuity
    // - Walking: avg 4.5 km/h walking speed, 1.18x circuity
    // -------------------------------------------------------------------------
    let circuity = 1.35;
    let avgSpeedKmh = 28;

    if (travelMode === "walking") {
      circuity = 1.18;
      avgSpeedKmh = 4.5;
    } else if (travelMode === "cycling") {
      circuity = 1.25;
      avgSpeedKmh = 13.0;
    }

    const estDistKm = parseFloat((straightLineKm * circuity).toFixed(1));
    const durationMins = Math.max(2, Math.round((estDistKm / avgSpeedKmh) * 60));
    const detourPercent = Math.round(((estDistKm - straightLineKm) / straightLineKm) * 100);

    const fallbackResult = {
      road_distance_km: estDistKm,
      straight_line_km: straightLineKm,
      detour_percent: detourPercent,
      duration_minutes: durationMins,
      mode: travelMode,
      is_road_distance: false,
      geometry: {
        type: "LineString",
        coordinates: [
          [start_lng, start_lat],
          [
            parseFloat(((start_lng + dest_lng) / 2 + 0.003).toFixed(5)),
            parseFloat(((start_lat + dest_lat) / 2 + 0.003).toFixed(5)),
          ],
          [dest_lng, dest_lat],
        ],
      },
      formatted_road_distance: `${estDistKm} km est. ${formattedMode}`,
      formatted_duration: `~${durationMins} mins ${modeLabel}`,
      summary: `${estDistKm} km · ~${durationMins} mins ${modeLabel}`,
      comparison_note: `${estDistKm} km ${formattedMode} (vs ${straightLineKm} km straight line)`,
    };

    routeCache.set(cacheKey, { timestamp: Date.now(), data: fallbackResult });
    return NextResponse.json(fallbackResult);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Route calculation error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return await handleRouteCalculation({
      start_lat: Number(body.start_lat),
      start_lng: Number(body.start_lng),
      dest_lat: Number(body.dest_lat),
      dest_lng: Number(body.dest_lng),
      mode: body.mode,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid request body" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start_lat = parseFloat(searchParams.get("start_lat") || "");
    const start_lng = parseFloat(searchParams.get("start_lng") || "");
    const dest_lat = parseFloat(searchParams.get("dest_lat") || "");
    const dest_lng = parseFloat(searchParams.get("dest_lng") || "");
    const mode = searchParams.get("mode") || "driving";

    return await handleRouteCalculation({
      start_lat,
      start_lng,
      dest_lat,
      dest_lng,
      mode,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Invalid query parameters" }, { status: 400 });
  }
}
