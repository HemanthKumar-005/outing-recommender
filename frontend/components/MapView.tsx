"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

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

// Free, keyless OpenStreetMap-based tiles. The public tile server is meant for light use
// (see https://operations.osmfoundation.org/policies/tiles/). For real traffic, set
// NEXT_PUBLIC_TILE_URL to a provider with a free tier or to your own tile server.
const TILE_URL = process.env.NEXT_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

export default function MapView({
  places = [],
  center,
  zoom = 13,
  selectedId,
  onSelectPlace,
  routeMode = false,
  height = 420,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const markersRef = useRef<Map<number, Marker>>(new Map());
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const onSelectRef = useRef(onSelectPlace);
  onSelectRef.current = onSelectPlace;

  // Create the map once (Leaflet touches `window`, so it is imported dynamically on the client).
  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = await import("leaflet");
      if (disposed || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const start = center || (places.length ? { lat: places[0].lat, lng: places[0].lng } : DEFAULT_CENTER);
      const map = L.map(containerRef.current, { zoomControl: true }).setView([start.lat, start.lng], zoom);
      L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      draw();
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPinColor(category: string, isSel: boolean): string {
    if (isSel) return "#e05e3a";
    const c = (category || "").toLowerCase();
    if (c.includes("cafe") || c.includes("restaurant") || c.includes("food")) return "#f97316";
    if (c.includes("park") || c.includes("outdoor") || c.includes("nature")) return "#10b981";
    if (c.includes("bar") || c.includes("brewery") || c.includes("nightlife")) return "#9333ea";
    if (c.includes("museum") || c.includes("art") || c.includes("culture")) return "#3b82f6";
    return "#f43f5e";
  }

  function popupContent(p: MapPlace): HTMLElement {
    const box = document.createElement("div");
    box.className = "custom-map-popup";
    box.style.padding = "6px 8px";
    box.style.fontFamily = "var(--font-body, system-ui)";
    box.style.minWidth = "180px";

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.fontSize = "0.95rem";
    title.style.color = "var(--text-primary, #111827)";
    title.style.marginBottom = "4px";
    title.textContent = p.name;
    box.appendChild(title);

    const meta = document.createElement("div");
    meta.style.fontSize = "0.8rem";
    meta.style.color = "var(--text-muted, #6b7280)";
    meta.style.display = "flex";
    meta.style.flexWrap = "wrap";
    meta.style.gap = "4px 8px";
    meta.style.marginBottom = "6px";

    const bits = [
      p.category ? p.category.toUpperCase() : null,
      p.city,
      p.rating ? `★ ${p.rating.toFixed(1)}` : null,
      p.match != null ? `${p.match}% match` : null,
    ];
    meta.textContent = bits.filter(Boolean).join(" · ");
    box.appendChild(meta);

    if (p.cost_for_two) {
      const price = document.createElement("div");
      price.style.fontSize = "0.78rem";
      price.style.color = "var(--coral-500, #cb4622)";
      price.style.fontWeight = "600";
      price.textContent = `~₹${Math.round(p.cost_for_two)} for two`;
      box.appendChild(price);
    }

    return box;
  }

  function draw() {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    markersRef.current.clear();

    const valid = places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    valid.forEach((p, i) => {
      const isSel = p.id === selectedId;
      const pinColor = getPinColor(p.category, isSel);
      const label = routeMode ? String(i + 1) : "";
      const size = isSel ? 36 : 28;

      const pinHtml = `
        <div style="
          position: relative;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          background: ${pinColor};
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.35)${isSel ? ", 0 0 0 4px rgba(224, 94, 58, 0.4)" : ""};
          border: 2px solid #ffffff;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          cursor: pointer;
        ">
          <div style="
            transform: rotate(45deg);
            color: #ffffff;
            font-weight: 700;
            font-size: ${size > 30 ? "13px" : "11px"};
            font-family: var(--font-mono, monospace);
          ">
            ${label || "●"}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: "custom-leaflet-marker",
        html: pinHtml,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size],
      });

      const marker = L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(layer);
      marker.bindPopup(popupContent(p));
      marker.on("click", () => onSelectRef.current?.(p.id));
      markersRef.current.set(p.id, marker);
    });

    if (routeMode && valid.length > 1) {
      L.polyline(valid.map((p) => [p.lat, p.lng] as [number, number]), {
        color: "var(--coral-500, #e05e3a)",
        weight: 4,
        opacity: 0.85,
        dashArray: "8, 6",
      }).addTo(layer);
    }
    if (valid.length > 1) {
      map.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number])), { padding: [36, 36], maxZoom: 16 });
    } else if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], zoom);
    } else if (center) {
      map.setView([center.lat, center.lng], zoom);
    }
  }

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, routeMode, selectedId, center?.lat, center?.lng]);

  useEffect(() => {
    if (selectedId != null) markersRef.current.get(selectedId)?.openPopup();
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="region"
      aria-label="Map of recommended places"
      style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", zIndex: 0 }}
    />
  );
}
