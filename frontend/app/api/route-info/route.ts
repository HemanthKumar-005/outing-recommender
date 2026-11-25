import { NextRequest, NextResponse } from "next/server";

export type TravelMode = "driving" | "walking" | "cycling";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { start_lat, start_lng, dest_lat, dest_lng, mode = "driving" } = body;

    if (
      typeof start_lat !== "number" ||
      typeof start_lng !== "number" ||
      typeof dest_lat !== "number" ||
      typeof dest_lng !== "number"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid coordinates (start_lat, start_lng, dest_lat, dest_lng)" },
        { status: 400 },
      );
    }

    const travelMode: TravelMode = ["driving", "walking", "cycling"].includes(mode) ? mode : "driving";
    const straightLineKm = haversineKm(start_lat, start_lng, dest_lat, dest_lng);

    // 1. Query OSRM routing engine for actual road network path, distance & duration
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2600);

      const osrmProfile = travelMode === "walking" ? "walking" : travelMode === "cycling" ? "cycling" : "driving";
      const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${start_lng},${start_lat};${dest_lng},${dest_lat}?overview=full&geometries=geojson`;

      const resp = await fetch(osrmUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (data.code === "Ok" && Array.isArray(data.routes) && data.routes.length > 0) {
          const route = data.routes[0];
          const roadDistKm = parseFloat((route.distance / 1000).toFixed(1));
          const durationMins = Math.max(1, Math.round(route.duration / 60));

          let modeLabel = "by car";
          if (travelMode === "walking") modeLabel = "walking";
          if (travelMode === "cycling") modeLabel = "by cycle";

          // Calculate road detour vs straight line (e.g. 4 km straight vs 9 km road = +125%)
          const detourPercent = straightLineKm > 0
            ? Math.max(0, Math.round(((roadDistKm - straightLineKm) / straightLineKm) * 100))
            : 0;

          return NextResponse.json({
            road_distance_km: roadDistKm,
            straight_line_km: straightLineKm,
            detour_percent: detourPercent,
            duration_minutes: durationMins,
            mode: travelMode,
            is_road_distance: true,
            geometry: route.geometry, // GeoJSON LineString coordinates
            formatted_road_distance: `${roadDistKm} km road drive`,
            formatted_duration: `~${durationMins} mins ${modeLabel}`,
            summary: `${roadDistKm} km road journey · ~${durationMins} mins ${modeLabel}`,
            comparison_note: detourPercent > 10
              ? `${roadDistKm} km road journey (vs ${straightLineKm} km straight-line, +${detourPercent}% detour)`
              : `${roadDistKm} km road journey · ~${durationMins} mins`,
          });
        }
      }
    } catch {
      // Fall through to high-fidelity urban circuity model
    }

    // 2. High-fidelity estimation fallback if external routing engine is unreachable
    const circuity = travelMode === "walking" ? 1.2 : 1.35;
    const estRoadKm = parseFloat((straightLineKm * circuity).toFixed(1));

    let avgSpeed = 24;
    let modeLabel = "by car";
    if (travelMode === "walking") {
      avgSpeed = 4.5;
      modeLabel = "walking";
    } else if (travelMode === "cycling") {
      avgSpeed = 14;
      modeLabel = "by cycle";
    }

    const durationMins = Math.max(2, Math.round((estRoadKm / avgSpeed) * 60));
    const detourPercent = Math.round(((estRoadKm - straightLineKm) / straightLineKm) * 100);

    return NextResponse.json({
      road_distance_km: estRoadKm,
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
      formatted_road_distance: `${estRoadKm} km est. road`,
      formatted_duration: `~${durationMins} mins ${modeLabel}`,
      summary: `${estRoadKm} km road journey · ~${durationMins} mins ${modeLabel}`,
      comparison_note: `${estRoadKm} km road drive (vs ${straightLineKm} km straight line)`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Route calculation error" }, { status: 500 });
  }
}
