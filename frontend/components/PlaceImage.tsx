"use client";

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
 * Category illustration. We deliberately show no third-party photos: Google's photo
 * API needs a billing account and licensing obligations, and a photo of the wrong
 * place is worse than none. User-uploaded or Wikimedia Commons photos can replace
 * this later.
 */
export default function PlaceImage({ placeName, category = "", className = "", style }: Props) {
  const cat = CATEGORY_ICONS[category.toLowerCase()] ?? { emoji: "📍", bg: "#eef1f4" };

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
      <span role="img" aria-label={`${category || "place"}: ${placeName}`}>{cat.emoji}</span>
    </div>
  );
}
