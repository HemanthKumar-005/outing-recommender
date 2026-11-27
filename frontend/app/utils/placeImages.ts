export const SPECIFIC_PLACE_IMAGES: Record<string, string> = {
  "toit brewpub": "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80",
  "cubbon park": "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=800&q=80",
  "lalbagh botanical garden": "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80",
  "arbor brewing company": "https://images.unsplash.com/photo-1575037614876-c38a4d44f5b8?auto=format&fit=crop&w=800&q=80",
  "windmills craftworks": "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=800&q=80",
  "truffles": "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80",
  "third wave coffee": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80",
  "blue tokai coffee roasters": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
  "mysore palace": "https://images.unsplash.com/photo-1600100397608-f010f443b351?auto=format&fit=crop&w=800&q=80",
  "brindavan gardens": "https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=800&q=80",
  "marine drive": "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=800&q=80",
  "india gate lawns": "https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=800&q=80",
  "national gallery of modern art": "https://images.unsplash.com/photo-1565034946487-077786996e27?auto=format&fit=crop&w=800&q=80",
  "visvesvaraya industrial & tech museum": "https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?auto=format&fit=crop&w=800&q=80",
  "visvesvaraya industrial & technological museum": "https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?auto=format&fit=crop&w=800&q=80",
  "government museum": "https://images.unsplash.com/photo-1565034946487-077786996e27?auto=format&fit=crop&w=800&q=80",
  "bangalore palace": "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80",
  "tipu sultan": "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80",
  "hal heritage centre": "https://images.unsplash.com/photo-1517976487502-5f79e9573887?auto=format&fit=crop&w=800&q=80",
  "nandi hills": "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
  "bull temple": "https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80",
  "jawaharlal nehru planetarium": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
  "bannerghatta national park": "https://images.unsplash.com/photo-1534177616072-ef7dc120449d?auto=format&fit=crop&w=800&q=80",
  "sankey tank": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
  "ulsoor lake": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
  "hampi": "https://images.unsplash.com/photo-1600100397608-f010f443b351?auto=format&fit=crop&w=800&q=80",
  "mavalli tiffin room (mtr)": "https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=800&q=80",
  "charminar area": "https://images.unsplash.com/photo-1609137144827-0fae2b170bc0?auto=format&fit=crop&w=800&q=80",
  "marina beach": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
};

export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  cafe: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80",
  restaurant: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
  bar: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80",
  park: "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=800&q=80",
  museum: "https://images.unsplash.com/photo-1565034946487-077786996e27?auto=format&fit=crop&w=800&q=80",
  attraction: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80",
  cinema: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80",
  shopping: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
};

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80";

export function getPlaceImageUrl(name: string, category?: string): string {
  const normalized = name.toLowerCase().trim();
  if (SPECIFIC_PLACE_IMAGES[normalized]) {
    return SPECIFIC_PLACE_IMAGES[normalized];
  }
  // partial match for famous spots
  for (const [key, url] of Object.entries(SPECIFIC_PLACE_IMAGES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return url;
    }
  }
  const cat = (category || "").toLowerCase().trim();
  return CATEGORY_FALLBACK_IMAGES[cat] || DEFAULT_IMAGE;
}

export function formatEstimatedPrice(priceRange?: number, averageCost?: number): string {
  if (averageCost && averageCost > 0) {
    return `~₹${Math.round(averageCost)} per person`;
  }
  switch (priceRange) {
    case 1:
      return "₹150 – ₹350 per person · $";
    case 2:
      return "₹400 – ₹750 per person · $$";
    case 3:
      return "₹800 – ₹1,500 per person · $$$";
    case 4:
      return "₹1,800+ per person · $$$$";
    default:
      return "Price not available";
  }
}
