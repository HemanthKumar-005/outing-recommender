"use client";

import { useEffect, useRef, useState } from "react";

export type MapPlace = {
  id: number;
  name: string;
  category: string;
  lat: number;
  lng: number;
  match?: number;
  rating?: number;
  price_range?: number;
  cost_for_two?: number;
  open_now?: boolean | null;
  city?: string;
};

type Props = {
  places: MapPlace[];
  center?: { lat: number; lng: number };
  zoom?: number;
  selectedId?: number | null;
  onSelectPlace?: (placeId: number) => void;
  routeMode?: boolean;
  height?: string | number;
  className?: string;
};

// Global script load promise tracker to avoid duplicate script tags
let googleMapsScriptLoading: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).google?.maps) return Promise.resolve();
  if (googleMapsScriptLoading) return googleMapsScriptLoading;

  googleMapsScriptLoading = new Promise((resolve, reject) => {
    const existing = document.getElementById("google-maps-js-sdk");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", (e) => reject(e));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-js-sdk";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });

  return googleMapsScriptLoading;
}

export default function GoogleMapView({
  places = [],
  center,
  zoom = 13,
  selectedId,
  onSelectPlace,
  routeMode = false,
  height = 420,
  className = "",
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [activePlace, setActivePlace] = useState<MapPlace | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";

  // 1. Load Google Maps SDK
  useEffect(() => {
    if (!apiKey) return;

    // Listen for Google Maps auth errors (e.g. unactivated API or billing missing in GCP)
    const prevAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      setAuthError(true);
      if (prevAuthFailure) prevAuthFailure();
    };

    let cancelled = false;
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!cancelled && (window as any).google?.maps) {
          setMapLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setAuthError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Compute default center from places or props
  const effectiveCenter = center || (places.length > 0
    ? { lat: places[0].lat, lng: places[0].lng }
    : { lat: 12.9716, lng: 77.5946 });

  // 2. Initialize or Update Google Map
  useEffect(() => {
    if (!mapLoaded || authError || !mapContainerRef.current || !(window as any).google?.maps) {
      return;
    }

    const google = (window as any).google;

    // Initialize Map if not created yet
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapContainerRef.current, {
        center: effectiveCenter,
        zoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
          { featureType: "transit", stylers: [{ visibility: "simplified" }] },
        ],
      });
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (places.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    const routeCoords: any[] = [];

    // Create markers for places
    places.forEach((p, idx) => {
      const position = { lat: p.lat, lng: p.lng };
      bounds.extend(position);
      routeCoords.push(position);

      const isSelected = selectedId === p.id;
      const markerLabel = routeMode ? String(idx + 1) : p.match ? `${p.match}%` : "";

      // Custom marker icon / styling
      const marker = new google.maps.Marker({
        position,
        map,
        title: p.name,
        label: markerLabel
          ? {
              text: markerLabel,
              color: isSelected ? "#ffffff" : "#1A1210",
              fontSize: "11px",
              fontWeight: "bold",
            }
          : undefined,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 16 : 13,
          fillColor: isSelected ? "#4f46e5" : "#e0e7ff",
          fillOpacity: 1,
          strokeColor: isSelected ? "#312e81" : "#6366f1",
          strokeWeight: 2,
        },
        zIndex: isSelected ? 999 : idx,
      });

      marker.addListener("click", () => {
        setActivePlace(p);
        if (onSelectPlace) onSelectPlace(p.id);

        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${p.name} ${p.city || ""}`
        )}`;

        const content = `
          <div style="font-family: inherit; padding: 6px 2px; min-width: 190px; color: #1f2937;">
            <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #4f46e5; margin-bottom: 2px;">
              ${p.category} ${routeMode ? `· Stop ${idx + 1}` : ""}
            </div>
            <strong style="font-size: 1.05rem; display: block; line-height: 1.3; color: #111827;">
              ${p.name}
            </strong>
            <div style="display: flex; gap: 8px; align-items: center; margin: 6px 0 10px;">
              ${
                p.match
                  ? `<span style="background: #e0e7ff; color: #3730a3; font-weight: 700; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px;">${p.match}% Match</span>`
                  : ""
              }
              ${
                p.rating
                  ? `<span style="font-size: 0.78rem; font-weight: 600; color: #b45309;">★ ${p.rating.toFixed(
                      1
                    )}</span>`
                  : ""
              }
              ${
                p.open_now !== undefined && p.open_now !== null
                  ? `<span style="font-size: 0.72rem; font-weight: 600; color: ${
                      p.open_now ? "#15803d" : "#b91c1c"
                    };">${p.open_now ? "● Open" : "○ Closed"}</span>`
                  : ""
              }
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e5e7eb; padding-top: 6px;">
              <span style="font-size: 0.75rem; color: #6b7280;">
                ${p.cost_for_two ? `~₹${Math.round(p.cost_for_two)} for two` : p.city || ""}
              </span>
              <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 0.75rem; color: #2563eb; font-weight: 600; text-decoration: none;">
                Directions ↗
              </a>
            </div>
          </div>
        `;

        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    // Draw route polyline in routeMode
    if (routeMode && routeCoords.length >= 2) {
      polylineRef.current = new google.maps.Polyline({
        path: routeCoords,
        geodesic: true,
        strokeColor: "#4f46e5",
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map,
      });
    }

    // Fit map bounds
    if (places.length === 1) {
      map.setCenter({ lat: places[0].lat, lng: places[0].lng });
      map.setZoom(14);
    } else if (places.length > 1) {
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }
  }, [mapLoaded, authError, places, selectedId, routeMode, zoom]);

  // Fallback View when Google Maps key is pending activation or offline
  const renderFallbackMap = () => {
    // Generate OpenStreetMap interactive embed centered on location with pins
    const osmQueryLat = effectiveCenter.lat;
    const osmQueryLng = effectiveCenter.lng;
    const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${osmQueryLng - 0.08}%2C${osmQueryLat - 0.06}%2C${osmQueryLng + 0.08}%2C${osmQueryLat + 0.06}&layer=mapnik&marker=${osmQueryLat}%2C${osmQueryLng}`;

    return (
      <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: "inherit", overflow: "hidden" }}>
        <iframe
          title="Interactive Area Map"
          width="100%"
          height="100%"
          style={{ border: 0, filter: "contrast(1.02)" }}
          loading="lazy"
          src={osmEmbedUrl}
        />
        {/* Floating marker overlay summary */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            right: 12,
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(6px)",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(0, 0, 0, 0.1)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            fontSize: "0.82rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "1rem" }}>🗺️</span>
            <span>
              <strong>{places.length} places</strong> plotted around {effectiveCenter.lat.toFixed(2)}, {effectiveCenter.lng.toFixed(2)}
            </span>
          </div>
          {authError && (
            <span style={{ color: "#b45309", fontSize: "0.75rem", fontWeight: 600 }}>
              Google Key Linked · (Enable Maps JavaScript API in GCP console for 3D aerial view)
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`google-map-wrapper ${className}`}
      style={{
        position: "relative",
        width: "100%",
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: "var(--radius, 12px)",
        overflow: "hidden",
        border: "1px solid var(--border, #e5e7eb)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        background: "#f9fafb",
      }}
    >
      {/* Top Banner showing Google Maps Status */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 10,
          zIndex: 5,
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(4px)",
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid rgba(0,0,0,0.08)",
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "#374151",
          display: "flex",
          alignItems: "center",
          gap: 6,
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <span style={{ color: mapLoaded && !authError ? "#16a34a" : "#ca8a04" }}>●</span>
        <span>
          {mapLoaded && !authError
            ? "Google Maps Active"
            : authError
            ? "Google Maps Demo Key Configured"
            : "Loading Google Maps..."}
        </span>
      </div>

      {/* Main Map Container */}
      {!authError ? (
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      ) : (
        renderFallbackMap()
      )}
    </div>
  );
}
