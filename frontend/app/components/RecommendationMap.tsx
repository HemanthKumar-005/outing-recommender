"use client";

import { useEffect, useRef, useState } from "react";

export type TravelMode = "driving" | "transit" | "cycling" | "walking";

export type MapPlace = {
  id: number;
  name: string;
  category: string;
  lat: number;
  lng: number;
  score: number;
  rating?: number;
  price_range?: number;
  road_distance_km?: number | null;
  straight_line_km?: number;
  travel_time?: string;
  detour_percent?: number;
  image_url?: string;
  booking_url?: string | null;
  mode?: TravelMode;
};

interface RecommendationMapProps {
  startLocation: { name: string; lat: number; lng: number } | null;
  destinationLocation: { name: string; lat: number; lng: number } | null;
  places: MapPlace[];
  selectedPlaceId?: number | null;
  onSelectPlace?: (placeId: number) => void;
  travelMode?: TravelMode;
  activeRouteGeometry?: any;
  routeStats?: {
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
  } | null;
}

export default function RecommendationMap({
  startLocation,
  destinationLocation,
  places,
  selectedPlaceId,
  onSelectPlace,
  travelMode = "driving",
  activeRouteGeometry,
  routeStats,
}: RecommendationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const routeLayerRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Load Leaflet CSS and JS dynamically in browser
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!(window as any).L) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => setMapLoaded(true);
      document.body.appendChild(script);
    } else {
      setMapLoaded(true);
    }
  }, []);

  // Initialize and update map
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || typeof window === "undefined") return;
    const L = (window as any).L;
    if (!L) return;

    // Initialize map if not yet created
    if (!mapInstanceRef.current) {
      const defaultCenter = destinationLocation
        ? [destinationLocation.lat, destinationLocation.lng]
        : startLocation
        ? [startLocation.lat, startLocation.lng]
        : [12.9716, 77.5946];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker: any) => marker.remove());
    markersRef.current = {};

    // Clear previous route polylines
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    const bounds = L.latLngBounds([]);

    // 1. Add Starting Location Marker (Green Pin)
    if (startLocation) {
      const startIcon = L.divIcon({
        className: "custom-map-marker-start",
        html: `
          <div style="background:#15803d; color:#fff; border:3px solid #fff; border-radius:50%; width:38px; height:38px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(0,0,0,0.35); font-size:18px;">
            🏠
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const startMarker = L.marker([startLocation.lat, startLocation.lng], { icon: startIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:system-ui,-apple-system,sans-serif; padding:4px;">
            <div style="font-size:11px; text-transform:uppercase; color:#15803d; font-weight:700;">🏠 Starting Point</div>
            <div style="font-weight:700; font-size:14px; margin-top:2px;">${startLocation.name}</div>
          </div>
        `);

      markersRef.current["start"] = startMarker;
      bounds.extend([startLocation.lat, startLocation.lng]);
    }

    // 2. Add Destination Center Marker (Target Pin)
    if (destinationLocation) {
      const destIcon = L.divIcon({
        className: "custom-map-marker-dest",
        html: `
          <div style="background:#0f766e; color:#fff; border:3px solid #fff; border-radius:50%; width:38px; height:38px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(0,0,0,0.35); font-size:18px;">
            🎯
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const destMarker = L.marker([destinationLocation.lat, destinationLocation.lng], { icon: destIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:system-ui,-apple-system,sans-serif; padding:4px;">
            <div style="font-size:11px; text-transform:uppercase; color:#0f766e; font-weight:700;">🎯 Destination Area</div>
            <div style="font-weight:700; font-size:14px; margin-top:2px;">${destinationLocation.name}</div>
          </div>
        `);

      markersRef.current["dest"] = destMarker;
      bounds.extend([destinationLocation.lat, destinationLocation.lng]);
    }

    // 3. Draw Actual Real-World Road Route Polyline
    let routeCoords: [number, number][] | null = null;
    if (activeRouteGeometry) {
      if (Array.isArray(activeRouteGeometry.coordinates)) {
        routeCoords = activeRouteGeometry.coordinates;
      } else if (typeof activeRouteGeometry === "string") {
        try {
          const parsed = JSON.parse(activeRouteGeometry);
          if (Array.isArray(parsed.coordinates)) routeCoords = parsed.coordinates;
        } catch {}
      }
    }

    if (routeCoords && routeCoords.length > 0) {
      const routeGroup = L.featureGroup();

      // Convert [lng, lat] GeoJSON to [lat, lng] Leaflet coordinates
      const latLngs = routeCoords.map((coord: [number, number]) => [coord[1], coord[0]]);

      // Choose mode-specific color palette
      let primaryColor = "#0f766e"; // Driving teal
      let glowColor = "#2dd4bf";
      let isDashed = false;

      if (travelMode === "cycling") {
        primaryColor = "#0284c7"; // Cycling sky blue
        glowColor = "#38bdf8";
      } else if (travelMode === "walking") {
        primaryColor = "#16a34a"; // Walking forest green
        glowColor = "#86efac";
      } else if (travelMode === "transit") {
        primaryColor = "#ea580c"; // Transit amber
        glowColor = "#fdba74";
        isDashed = true;
      }

      // Glow / shadow underlay line
      const glow = L.polyline(latLngs, {
        color: glowColor,
        weight: 9,
        opacity: 0.45,
        lineCap: "round",
        lineJoin: "round",
      });

      // Primary road trajectory polyline
      const mainLine = L.polyline(latLngs, {
        color: primaryColor,
        weight: 5,
        opacity: 0.95,
        dashArray: isDashed ? "8, 8" : undefined,
        lineCap: "round",
        lineJoin: "round",
      });

      routeGroup.addLayer(glow);
      routeGroup.addLayer(mainLine);
      routeGroup.addTo(map);

      routeLayerRef.current = routeGroup;

      latLngs.forEach((pt: any) => bounds.extend(pt));
    }

    // 4. Add Recommended Place Markers
    const googleTravelMode =
      travelMode === "cycling"
        ? "bicycling"
        : travelMode === "walking"
        ? "walking"
        : travelMode === "transit"
        ? "transit"
        : "driving";

    places.forEach((place, index) => {
      const isSelected = selectedPlaceId === place.id;
      const markerColor = isSelected ? "#ea580c" : "#0f766e";
      const markerSize = isSelected ? 42 : 32;

      const placeIcon = L.divIcon({
        className: `custom-map-marker-place ${isSelected ? "selected" : ""}`,
        html: `
          <div style="background:${markerColor}; color:#fff; border:2.5px solid #fff; border-radius:50%; width:${markerSize}px; height:${markerSize}px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.35); font-weight:700; font-size:13px; font-family:sans-serif; cursor:pointer; transition:transform 0.15s ease;">
            ${index + 1}
          </div>
        `,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2],
      });

      const directionsUrl = startLocation
        ? `https://www.google.com/maps/dir/?api=1&origin=${startLocation.lat},${startLocation.lng}&destination=${place.lat},${place.lng}&travelmode=${googleTravelMode}`
        : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;

      const popupContent = `
        <div style="font-family:system-ui,-apple-system,sans-serif; min-width:230px; max-width:280px; padding:2px;">
          ${
            place.image_url
              ? `<div style="width:100%; height:115px; border-radius:6px; background-image:url('${place.image_url}'); background-size:cover; background-position:center; margin-bottom:8px;"></div>`
              : ""
          }
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-size:10px; text-transform:uppercase; letter-spacing:0.06em; color:#0f766e; font-weight:700;">
              #${index + 1} · ${place.category}
            </span>
            <span style="font-size:11px; font-weight:700; background:#e6f4f2; color:#0f766e; padding:2px 6px; border-radius:10px;">
              ${Math.round(place.score * 100)}% match
            </span>
          </div>
          <div style="font-weight:700; font-size:14px; color:#1c1917; margin-bottom:4px;">
            ${place.name}
          </div>
          <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">
            ${place.rating ? `★ ${place.rating} · ` : ""}${place.price_range ? "$".repeat(place.price_range) : ""}
          </div>
          ${
            place.road_distance_km != null
              ? `<div style="font-size:12px; color:#0f766e; font-weight:600; background:#f0fdf4; border:1px solid #bbf7d0; padding:5px 8px; border-radius:6px; margin-bottom:8px;">
                  ${travelMode === "cycling" ? "🚲" : travelMode === "walking" ? "🚶" : "🚗"} ${place.road_distance_km} km · ${place.travel_time || ""}
                  ${place.straight_line_km ? `<div style="font-size:10px; color:#6b7280; font-weight:normal; margin-top:2px;">(${place.straight_line_km} km straight line)</div>` : ""}
                </div>`
              : place.mode === "transit"
              ? `<div style="font-size:11px; color:#854d0e; background:#fefce8; border:1px solid #fef08a; padding:5px 8px; border-radius:6px; margin-bottom:8px;">
                  🚌 Timetable routing unavailable · View live schedules in Google Maps
                </div>`
              : ""
          }
          <div style="display:flex; gap:6px; margin-top:8px;">
            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="flex:1; text-align:center; background:#0f766e; color:#fff; text-decoration:none; padding:7px 10px; border-radius:6px; font-size:11px; font-weight:600; display:inline-block;">
              🧭 Turn-by-Turn GPS →
            </a>
            ${
              place.booking_url
                ? `<a href="${place.booking_url}" target="_blank" rel="noopener noreferrer" style="flex:1; text-align:center; background:#f4f3ef; color:#1c1917; border:1px solid #d1d5db; text-decoration:none; padding:7px 8px; border-radius:6px; font-size:11px; font-weight:600; display:inline-block;">Book</a>`
                : ""
            }
          </div>
        </div>
      `;

      const marker = L.marker([place.lat, place.lng], { icon: placeIcon })
        .addTo(map)
        .bindPopup(popupContent);

      marker.on("click", () => {
        if (onSelectPlace) onSelectPlace(place.id);
      });

      markersRef.current[`place-${place.id}`] = marker;
      bounds.extend([place.lat, place.lng]);

      if (isSelected) {
        marker.openPopup();
      }
    });

    // 5. Fit bounds to comfortably display the route and places
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [
    mapLoaded,
    startLocation,
    destinationLocation,
    places,
    selectedPlaceId,
    travelMode,
    activeRouteGeometry,
    onSelectPlace,
  ]);

  return (
    <div
      className="recommendation-map-wrapper"
      style={{
        position: "relative",
        width: "100%",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid var(--hairline-paper)",
        boxShadow: "0 16px 40px -16px rgba(26,40,38,0.22)",
      }}
    >
      <div ref={mapContainerRef} style={{ width: "100%", height: "540px", background: "#f3f0e8" }} />

      {!mapLoaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f7f6f2",
            color: "var(--on-paper-muted)",
            fontSize: "0.92rem",
          }}
        >
          Loading road network &amp; interactive route map...
        </div>
      )}

      {/* Floating Mode-Specific Journey HUD */}
      {routeStats && (
        <div
          style={{
            position: "absolute",
            top: "14px",
            right: "14px",
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(15, 118, 110, 0.28)",
            borderRadius: "12px",
            padding: "12px 16px",
            fontSize: "0.82rem",
            color: "var(--on-paper-ink)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
            zIndex: 1000,
            maxWidth: "320px",
          }}
        >
          {travelMode === "transit" || routeStats.transit_available === false ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "#854d0e", fontWeight: 700, letterSpacing: "0.06em" }}>
                  🚌 Public Transit
                </span>
                <span style={{ fontSize: "0.68rem", color: "#854d0e", fontWeight: 700, background: "#fef08a", padding: "1px 6px", borderRadius: "4px" }}>
                  Status
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: "0.96rem", color: "var(--on-paper-ink)", marginBottom: 4 }}>
                Schedules Unavailable
              </div>
              <p style={{ margin: "0 0 8px 0", fontSize: "0.76rem", color: "var(--on-paper-muted)", lineHeight: 1.4 }}>
                Live GTFS transit feeds are not configured for this corridor.
              </p>
              {routeStats.directions_url && (
                <a
                  href={routeStats.directions_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "var(--accent)",
                    textDecoration: "underline",
                  }}
                >
                  View live timings on Google Maps →
                </a>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--accent)", fontWeight: 700, letterSpacing: "0.06em" }}>
                  {travelMode === "cycling" ? "🚲 Cycling Route" : travelMode === "walking" ? "🚶 Pedestrian Walk" : "🚗 Driving Route"}
                </span>
                <span style={{ fontSize: "0.68rem", color: "#15803d", fontWeight: 700, background: "#dcfce7", padding: "1px 6px", borderRadius: "4px" }}>
                  OSM Live
                </span>
              </div>
              {routeStats.target_name && (
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--on-paper-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>
                  To: {routeStats.target_name}
                </div>
              )}
              <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--accent)" }}>
                {routeStats.road_distance_km != null ? `${routeStats.road_distance_km} km` : `${routeStats.straight_line_km} km`}
                <span style={{ fontSize: "0.82rem", fontWeight: "normal", color: "var(--on-paper-ink)", marginLeft: 6 }}>
                  {travelMode === "cycling" ? "bike path" : travelMode === "walking" ? "on foot" : "road journey"}
                </span>
              </div>
              {routeStats.duration_minutes != null && (
                <div style={{ fontSize: "0.84rem", color: "var(--on-paper-ink)", fontWeight: 600, marginTop: 1 }}>
                  ⏱️ ~{routeStats.duration_minutes} mins {travelMode === "cycling" ? "by cycle" : travelMode === "walking" ? "on foot" : "by car"}
                </div>
              )}
              {routeStats.straight_line_km != null && routeStats.detour_percent != null && routeStats.detour_percent > 0 && (
                <div style={{ fontSize: "0.72rem", color: "var(--on-paper-muted)", marginTop: 4, borderTop: "1px dashed var(--hairline-paper)", paddingTop: 4 }}>
                  Straight-line: {routeStats.straight_line_km} km <span style={{ color: "#c2410c", fontWeight: 600 }}>(+{routeStats.detour_percent}% detour)</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legend Footer */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          left: "12px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(6px)",
          padding: "6px 14px",
          borderRadius: "8px",
          fontSize: "0.76rem",
          color: "var(--on-paper-ink)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          display: "flex",
          gap: "14px",
          alignItems: "center",
          flexWrap: "wrap",
          zIndex: 1000,
        }}
      >
        <span><strong style={{ color: "#15803d" }}>🏠 Start</strong></span>
        <span><strong style={{ color: "#0f766e" }}>🎯 Explore</strong></span>
        <span><strong style={{ color: "#0f766e" }}>① ② ③ Venues</strong></span>
        <span style={{ color: travelMode === "cycling" ? "#0284c7" : travelMode === "walking" ? "#16a34a" : "#0f766e", fontWeight: 600 }}>
          ── {travelMode === "cycling" ? "Bicycle Path" : travelMode === "walking" ? "Pedestrian Route" : "Road Network"}
        </span>
      </div>
    </div>
  );
}
