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

  function popupContent(p: MapPlace): HTMLElement {
    // Built with DOM nodes + textContent (never innerHTML), so venue names cannot inject markup.
    const box = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = p.name;
    box.appendChild(title);
    const meta = document.createElement("div");
    const bits = [p.category, p.city, p.match != null ? `${p.match}% match` : null, p.rating ? `★ ${p.rating.toFixed(1)}` : null];
    meta.textContent = bits.filter(Boolean).join(" · ");
    box.appendChild(meta);
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
      const label = routeMode ? String(i + 1) : "";
      const isSel = p.id === selectedId;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${isSel ? 32 : 26}px;height:${isSel ? 32 : 26}px;border-radius:50%;background:${isSel ? "#b3541e" : "#2f6f5e"};color:#fff;display:flex;align-items:center;justify-content:center;font:600 12px system-ui;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${label}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marker = L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(layer);
      marker.bindPopup(popupContent(p));
      marker.on("click", () => onSelectRef.current?.(p.id));
      markersRef.current.set(p.id, marker);
    });

    if (routeMode && valid.length > 1) {
      L.polyline(valid.map((p) => [p.lat, p.lng] as [number, number]), { color: "#2f6f5e", weight: 4, opacity: 0.8, dashArray: "6 6" }).addTo(layer);
    }
    if (valid.length > 1) {
      map.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number])), { padding: [32, 32], maxZoom: 16 });
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
