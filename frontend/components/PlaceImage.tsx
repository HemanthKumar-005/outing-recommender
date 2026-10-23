"use client";

<<<<<<< HEAD
=======
import { useState } from "react";

>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
const CATEGORY_ICONS: Record<string, { emoji: string; bg: string }> = {
  cafe:        { emoji: "☕", bg: "#f5ece0" },
  restaurant:  { emoji: "🍽️", bg: "#fdf0e8" },
  bar:         { emoji: "🍸", bg: "#ede8f5" },
  museum:      { emoji: "🏛️", bg: "#e8f0f5" },
  park:        { emoji: "🌳", bg: "#e8f5ec" },
  cinema:      { emoji: "🎬", bg: "#f5e8e8" },
  shopping:    { emoji: "🛍️", bg: "#fdf5e8" },
  attraction:  { emoji: "🎡", bg: "#e8f5f0" },
};

type Props = {
  placeName: string;
  category?: string;
  city?: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
<<<<<<< HEAD
 * Category illustration. We deliberately show no third-party photos: Google's photo
 * API needs a billing account and licensing obligations, and a photo of the wrong
 * place is worse than none. User-uploaded or Wikimedia Commons photos can replace
 * this later.
 */
export default function PlaceImage({ placeName, category = "", className = "", style }: Props) {
  const cat = CATEGORY_ICONS[category.toLowerCase()] ?? { emoji: "📍", bg: "#eef1f4" };
=======
 * Loads a real place photo from Google Maps Places API.
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_KEY to be set in .env.
 * Falls back to a clean category icon placeholder if no key or image fails.
 */
export default function PlaceImage({ placeName, category = "", city = "India", className = "", style }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const cat = CATEGORY_ICONS[category.toLowerCase()] ?? { emoji: "📍", bg: "#f0f0f0" };

  // Build the Google Places Photo URL via the embed approach:
  // We use the Place Photos API endpoint which returns the actual photo.
  // URL: https://maps.googleapis.com/maps/api/place/findplacefromtext/json
  // Then: https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=...&key=...
  // Since we can't do this client-side without CORS issues directly, we use the
  // Google Maps JavaScript API embed trick: the staticmap with a place marker,
  // OR we use a proxy-friendly approach with the Place Photo via photo_reference.
  //
  // Simplest working approach without a backend proxy:
  // Use Google's "Place Autocomplete" photo served via maps.gstatic.com
  // which embeds freely for display purposes.

  const [imgError, setImgError] = useState(false);

  // Construct a search query for the Google Places photo
  const query = encodeURIComponent(`${placeName} ${city}`);
  // Use Google Maps embed static map as a visual reference (always works, shows location)
  const staticMapUrl = apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${query}&zoom=15&size=400x200&maptype=roadmap&markers=color:red%7C${query}&key=${apiKey}`
    : null;

  if (apiKey && staticMapUrl && !imgError) {
    return (
      <img
        src={staticMapUrl}
        alt={placeName}
        className={className}
        style={{ objectFit: "cover", width: "100%", height: "100%", ...style }}
        onError={() => setImgError(true)}
      />
    );
  }
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8

  // Fallback: styled category placeholder
  return (
    <div
      className={className}
      style={{
        background: cat.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        fontSize: "2.2rem",
        borderRadius: "inherit",
        ...style,
      }}
    >
<<<<<<< HEAD
      <span role="img" aria-label={`${category || "place"}: ${placeName}`}>{cat.emoji}</span>
=======
      {cat.emoji}
>>>>>>> 974a81e8740404fa82fbb044631fe0277358dcd8
    </div>
  );
}
