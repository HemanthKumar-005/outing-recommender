import { NextRequest, NextResponse } from "next/server";

export type GeocodeLocation = {
  name: string;
  label: string;
  lat: number;
  lng: number;
  category?: string;
  city?: string;
};

// Curated list of high-accuracy locations, cities, landmarks, and localities
const CURATED_LOCATIONS: GeocodeLocation[] = [
  // Major Bengaluru Localities / Starting Points & Destinations
  { name: "Bengaluru", label: "Bengaluru, Karnataka (City Center)", lat: 12.9716, lng: 77.5946, city: "Bengaluru" },
  { name: "Indiranagar", label: "Indiranagar, Bengaluru", lat: 12.9784, lng: 77.6408, city: "Bengaluru" },
  { name: "Koramangala", label: "Koramangala, Bengaluru", lat: 12.9352, lng: 77.6245, city: "Bengaluru" },
  { name: "MG Road", label: "MG Road, Bengaluru", lat: 12.9756, lng: 77.6066, city: "Bengaluru" },
  { name: "Cubbon Park", label: "Cubbon Park, Bengaluru", lat: 12.9763, lng: 77.5929, city: "Bengaluru" },
  { name: "Church Street", label: "Church Street, Bengaluru", lat: 12.9749, lng: 77.6053, city: "Bengaluru" },
  { name: "Brigade Road", label: "Brigade Road, Bengaluru", lat: 12.9726, lng: 77.6074, city: "Bengaluru" },
  { name: "Whitefield", label: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7500, city: "Bengaluru" },
  { name: "Electronic City", label: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770, city: "Bengaluru" },
  { name: "Jayanagar", label: "Jayanagar, Bengaluru", lat: 12.9308, lng: 77.5838, city: "Bengaluru" },
  { name: "HSR Layout", label: "HSR Layout, Bengaluru", lat: 12.9121, lng: 77.6446, city: "Bengaluru" },
  { name: "JP Nagar", label: "JP Nagar, Bengaluru", lat: 12.9077, lng: 77.5855, city: "Bengaluru" },
  { name: "Lalbagh", label: "Lalbagh Botanical Garden, Bengaluru", lat: 12.9507, lng: 77.5848, city: "Bengaluru" },
  { name: "Malleshwaram", label: "Malleshwaram, Bengaluru", lat: 13.0031, lng: 77.5643, city: "Bengaluru" },
  { name: "Hebbal", label: "Hebbal / Manyata Tech Park, Bengaluru", lat: 13.0358, lng: 77.5970, city: "Bengaluru" },
  { name: "Marathahalli", label: "Marathahalli, Bengaluru", lat: 12.9591, lng: 77.6974, city: "Bengaluru" },
  { name: "Bellandur", label: "Bellandur / EcoSpace, Bengaluru", lat: 12.9260, lng: 77.6762, city: "Bengaluru" },
  { name: "Bengaluru Airport", label: "Kempegowda International Airport (BLR)", lat: 13.1986, lng: 77.7066, city: "Bengaluru" },
  { name: "Nandi Hills", label: "Nandi Hills, Chikkaballapur (Near Bengaluru)", lat: 13.3702, lng: 77.6835, city: "Bengaluru" },
  
  // Mysore / Mysuru
  { name: "Mysuru", label: "Mysuru (Mysore), Karnataka", lat: 12.2958, lng: 76.6394, city: "Mysuru" },
  { name: "Mysore Palace", label: "Mysore Palace, Mysuru", lat: 12.3052, lng: 76.6552, city: "Mysuru" },
  { name: "Brindavan Gardens", label: "Brindavan Gardens, Mysuru", lat: 12.4243, lng: 76.5731, city: "Mysuru" },
  { name: "Chamundi Hill", label: "Chamundi Hill, Mysuru", lat: 12.2727, lng: 76.6710, city: "Mysuru" },
  { name: "Gokulam", label: "Gokulam, Mysuru", lat: 12.3323, lng: 76.6315, city: "Mysuru" },

  // Other Karnataka Destinations
  { name: "Coorg", label: "Coorg (Madikeri), Karnataka", lat: 12.4244, lng: 75.7382, city: "Coorg" },
  { name: "Mangalore", label: "Mangalore (Mangaluru), Karnataka", lat: 12.9141, lng: 74.8560, city: "Mangalore" },
  { name: "Udupi", label: "Udupi, Karnataka", lat: 13.3409, lng: 74.7421, city: "Udupi" },
  { name: "Chikmagalur", label: "Chikmagalur, Karnataka", lat: 13.3161, lng: 75.7720, city: "Chikmagalur" },

  // Major Metros (Starting & Destination Points)
  { name: "Mumbai", label: "Mumbai, Maharashtra", lat: 18.9432, lng: 72.8235, city: "Mumbai" },
  { name: "Bandra", label: "Bandra, Mumbai", lat: 19.0596, lng: 72.8295, city: "Mumbai" },
  { name: "Andheri", label: "Andheri, Mumbai", lat: 19.1136, lng: 72.8697, city: "Mumbai" },
  { name: "Marine Drive", label: "Marine Drive, Mumbai", lat: 18.9432, lng: 72.8235, city: "Mumbai" },
  { name: "Delhi", label: "New Delhi, Delhi", lat: 28.6139, lng: 77.2090, city: "Delhi" },
  { name: "Connaught Place", label: "Connaught Place, New Delhi", lat: 28.6304, lng: 77.2177, city: "Delhi" },
  { name: "Hauz Khas", label: "Hauz Khas Village, New Delhi", lat: 28.5494, lng: 77.2001, city: "Delhi" },
  { name: "Gurgaon", label: "Cyber Hub / DLF CyberCity, Gurgaon", lat: 28.4950, lng: 77.0895, city: "Gurgaon" },
  { name: "Hyderabad", label: "Hyderabad, Telangana", lat: 17.3850, lng: 78.4867, city: "Hyderabad" },
  { name: "Banjara Hills", label: "Banjara Hills, Hyderabad", lat: 17.4156, lng: 78.4347, city: "Hyderabad" },
  { name: "Hitec City", label: "Hitec City, Hyderabad", lat: 17.4474, lng: 78.3762, city: "Hyderabad" },
  { name: "Chennai", label: "Chennai, Tamil Nadu", lat: 13.0827, lng: 80.2707, city: "Chennai" },
  { name: "Pune", label: "Pune, Maharashtra", lat: 18.5204, lng: 73.8567, city: "Pune" },
  { name: "Kolkata", label: "Kolkata, West Bengal", lat: 22.5726, lng: 88.3639, city: "Kolkata" },
  { name: "Goa", label: "Panaji, Goa", lat: 15.4989, lng: 73.8278, city: "Goa" },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  if (!q) {
    // Return top popular recommendations for immediate display
    return NextResponse.json({
      suggestions: CURATED_LOCATIONS.slice(0, 8),
    });
  }

  // 1. Search local curated gazetteer first for instantaneous results
  const localMatches = CURATED_LOCATIONS.filter((loc) => {
    const n = loc.name.toLowerCase();
    const l = loc.label.toLowerCase();
    return n.includes(q) || l.includes(q);
  });

  // If we have strong local matches, return them immediately
  if (localMatches.length >= 3) {
    return NextResponse.json({ suggestions: localMatches.slice(0, 8) });
  }

  // 2. Query Nominatim for broader or international / unlisted places
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2200);

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      q,
    )}&addressdetails=1&limit=5`;

    const resp = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "NearbyApp-OutingPlanner/1.0 (contact: info@nearbyapp.local)",
      },
    });

    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const remoteMatches: GeocodeLocation[] = data.map((item: any) => ({
          name: item.name || item.display_name.split(",")[0].trim(),
          label: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          city: item.address?.city || item.address?.town || item.address?.state,
        }));

        // Merge local and remote, deduplicating
        const combined = [...localMatches];
        for (const rem of remoteMatches) {
          if (!combined.some((c) => Math.abs(c.lat - rem.lat) < 0.01 && Math.abs(c.lng - rem.lng) < 0.01)) {
            combined.push(rem);
          }
        }
        return NextResponse.json({ suggestions: combined.slice(0, 8) });
      }
    }
  } catch {
    // Fall back gracefully to local matches if network query fails or times out
  }

  return NextResponse.json({
    suggestions: localMatches,
  });
}
