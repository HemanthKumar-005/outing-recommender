"use client";

import { useEffect, useRef, useState } from "react";

export type MapPlace = {
  id: number;
  name: string;
  category: string;
  lat: number;
  lng: number;
  score: number;
  rating?: number;
  price_range?: number;
  road_distance_km?: number;
  straight_line_km?: number;
  travel_time?: string;
  detour_percent?: number;
  image_url?: string;
  booking_url?: string | null;
};

interface RecommendationMapProps {
  startLocation: { name: string; lat: number; lng: number } | null;
  destinationLocation: { name: string; lat: number; lng: number } | null;
  places: MapPlace[];
  selectedPlaceId?: number | null;
  onSelectPlace?: (placeId: number) => void;
  travelMode?: "driving" | "walking" | "cycling";
  activeRouteGeometry?: any;
  routeStats?: {
    road_distance_km: number;
    straight_line_km: number;
    duration_minutes: number;
    detour_percent: number;
    summary: string;
    target_name?: string;
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
          <div style="background:#15803d; color:#fff; border:3px solid #fff; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(0,0,0,0.35); font-size:18px;">
            🏠
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
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
          <div style="background:#0f766e; color:#fff; border:3px solid #fff; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(0,0,0,0.35); font-size:18px;">
            🎯
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
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

    // 3. Draw Actual Real-World Road Route Polyline from OSRM
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

      // Glow / shadow underlay line
      const glow = L.polyline(latLngs, {
        color: "#2dd4bf",
        weight: 9,
        opacity: 0.45,
        lineCap: "round",
        lineJoin: "round",
      });

      // Primary road trajectory polyline
      const mainLine = L.polyline(latLngs, {
        color: "#0f766e",
        weight: 5,
        opacity: 0.95,
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
    places.forEach((place, index) => {
      const isSelected = selectedPlaceId === place.id;
      const markerColor = isSelected ? "#ea580c" : "#0f766e";
      const markerSize = isSelected ? 40 : 32;

      const placeIcon = L.divIcon({
        className: `custom-map-marker-place ${isSelected ? "selected" : ""}`,
        html: `
          <div style="background:${markerColor}; color:#fff; border:2px solid #fff; border-radius:50%; width:${markerSize}px; height:${markerSize}px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.35); font-weight:700; font-size:13px; font-family:sans-serif; cursor:pointer; transition:transform 0.15s ease;">
            ${index + 1}
          </div>
        `,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2],
      });

      const directionsUrl = startLocation
        ? `https://www.google.com/maps/dir/?api=1&origin=${startLocation.lat},${startLocation.lng}&destination=${place.lat},${place.lng}&travelmode=${travelMode}`
        : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;

      const popupContent = `
        <div style="font-family:system-ui,-apple-system,sans-serif; min-width:220px; max-width:270px; padding:2px;">
          ${
            place.image_url
              ? `<div style="width:100%; height:110px; border-radius:6px; background-image:url('${place.image_url}'); background-size:cover; background-position:center; margin-bottom:8px;"></div>`
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
            place.road_distance_km
              ? `<div style="font-size:12px; color:#0f766e; font-weight:600; background:#f0fdf4; border:1px solid #bbf7d0; padding:4px 8px; border-radius:5px; margin-bottom:8px;">
                  🛣️ ${place.road_distance_km} km road drive · ${place.travel_time || "~20 mins"}
                  ${place.straight_line_km ? `<div style="font-size:10px; color:#6b7280; font-weight:normal; margin-top:1px;">(${place.straight_line_km} km straight line)</div>` : ""}
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
        borderRadius: "14px",
        overflow: "hidden",
        border: "1px solid var(--hairline-paper)",
        boxShadow: "0 12px 32px -14px rgba(26,40,38,0.18)",
      }}
    >
      <div ref={mapContainerRef} style={{ width: "100%", height: "460px", background: "#f3f0e8" }} />

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
            fontSize: "0.9rem",
          }}
        >
          Loading road network &amp; interactive route map...
        </div>
      )}

      {/* Floating Road Journey HUD */}
      {routeStats && (
        <div
          style={{
            position: "absolute",
            top: "14px",
            right: "14px",
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(15, 118, 110, 0.3)",
            borderRadius: "10px",
            padding: "11px 15px",
            fontSize: "0.82rem",
            color: "var(--on-paper-ink)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.16)",
            zIndex: 1000,
            maxWidth: "300px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
            <span style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)", textTransform: "uppercase", color: "var(--accent)", fontWeight: 700, letterSpacing: "0.06em" }}>
              🛣️ Road Route
            </span>
            <span style={{ fontSize: "0.68rem", color: "#15803d", fontWeight: 700, background: "#dcfce7", padding: "1px 5px", borderRadius: "4px" }}>
              OSRM
            </span>
          </div>
          {routeStats.target_name && (
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--on-paper-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>
              To: {routeStats.target_name}
            </div>
          )}
          <div style={{ fontWeight: 700, fontSize: "1.02rem", color: "var(--accent)" }}>
            {routeStats.road_distance_km} km road journey
          </div>
          <div style={{ fontSize: "0.82rem", color: "var(--on-paper-ink)", fontWeight: 600, marginTop: 1 }}>
            ⏱️ ~{routeStats.duration_minutes} mins {travelMode === "walking" ? "walking" : travelMode === "cycling" ? "cycling" : "by car"}
          </div>
          {routeStats.straight_line_km != null && routeStats.detour_percent > 0 && (
            <div style={{ fontSize: "0.72rem", color: "var(--on-paper-muted)", marginTop: 4, borderTop: "1px dashed var(--hairline-paper)", paddingTop: 4 }}>
              Straight-line: {routeStats.straight_line_km} km <span style={{ color: "#c2410c", fontWeight: 600 }}>(+{routeStats.detour_percent}% road detour)</span>
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
          zIndex: 1000,
        }}
      >
        <span><strong style={{ color: "#15803d" }}>🏠 Start Point</strong></span>
        <span><strong style={{ color: "#0f766e" }}>🎯 Explore Area</strong></span>
        <span><strong style={{ color: "#0f766e" }}>① ② ③ Places</strong></span>
        <span style={{ color: "#0f766e", fontWeight: 600 }}>── Real Road Route</span>
      </div>
    </div>
  );
}
