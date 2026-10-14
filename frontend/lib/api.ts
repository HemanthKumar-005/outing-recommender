const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_API_KEY || "demo-key";

export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("nearby_api_url") || DEFAULT_API_URL;
  }
  return DEFAULT_API_URL;
}

export function getApiKey(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("nearby_api_key") || DEFAULT_API_KEY;
  }
  return DEFAULT_API_KEY;
}

export function setSession(data: {
  apiKey: string;
  tenantId?: string;
  workspaceName?: string;
  userName?: string;
  email?: string;
}) {
  if (typeof window === "undefined") return;
  localStorage.setItem("nearby_api_key", data.apiKey);
  if (data.tenantId) localStorage.setItem("nearby_tenant_id", data.tenantId);
  if (data.workspaceName) localStorage.setItem("nearby_workspace", data.workspaceName);
  if (data.userName) localStorage.setItem("nearby_user_name", data.userName);
  if (data.email) localStorage.setItem("nearby_email", data.email);
  localStorage.setItem("nearby_authenticated", "true");
}

export function getSession() {
  if (typeof window === "undefined") return null;
  const apiKey = localStorage.getItem("nearby_api_key");
  if (!apiKey) return null;
  return {
    apiKey,
    tenantId: localStorage.getItem("nearby_tenant_id") || "",
    workspaceName: localStorage.getItem("nearby_workspace") || "",
    userName: localStorage.getItem("nearby_user_name") || "",
    email: localStorage.getItem("nearby_email") || "",
  };
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("nearby_api_key");
  localStorage.removeItem("nearby_tenant_id");
  localStorage.removeItem("nearby_workspace");
  localStorage.removeItem("nearby_user_name");
  localStorage.removeItem("nearby_email");
  localStorage.removeItem("nearby_authenticated");
  localStorage.removeItem("nearby_onboarded");
  localStorage.removeItem("nearby_preferences");
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("nearby_authenticated") === "true" && !!localStorage.getItem("nearby_api_key");
}

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("nearby_onboarded") === "true";
}

export function getUserInfo(): {
  id: number;
  name: string;
  workspace: string;
  email: string;
  tenantId?: string;
} {
  if (typeof window === "undefined") {
    return { id: 1, name: "Guest", workspace: "Demo", email: "" };
  }
  const storedId = localStorage.getItem("nearby_user_id");
  return {
    id: storedId ? parseInt(storedId, 10) || 1 : 1,
    name: localStorage.getItem("nearby_user_name") || "Guest",
    workspace: localStorage.getItem("nearby_workspace") || "Demo workspace",
    email: localStorage.getItem("nearby_email") || "",
    tenantId: localStorage.getItem("nearby_tenant_id") || "",
  };
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${getApiUrl().replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const headers = new Headers(options.headers || {});
  headers.set("X-API-Key", getApiKey());
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...options, headers });
  return res;
}

export async function signupTenant(name: string) {
  // Signup hits the gateway root /tenants (not under /api)
  const base = getApiUrl().replace(/\/api\/?$/, "");
  const res = await fetch(`${base}/tenants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Signup failed (${res.status})`);
  }
  return res.json() as Promise<{ tenant_id: string; name: string; api_key: string }>;
}

export type Place = {
  id: number;
  name: string;
  category: string;
  subcategory?: string;
  price_range: number;
  cost_for_two?: number;
  average_cost?: number;
  entry_fee?: number;
  cost_text?: string;
  entry_text?: string;
  price_symbols?: string;
  pricing_is_estimated?: boolean;
  pricing_source?: string;
  distance_km?: number;
  rating?: number;
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  opening_hours?: Record<string, string[][]>;
  opening_hours_source?: string;
  opening_hours_is_estimated?: boolean;
  open_now?: boolean | null;
  hours_status?: string;
  hours_detail?: string;
  today_hours?: string;
  weekly_hours?: Record<string, string[][]>;
  closes_in_minutes?: number | null;
  opens_at?: string | null;
  tags?: string[];
  ambience?: string[];
  description?: string;
};

export type Recommendation = {
  place: Place;
  score: number;
  distance_km?: number;
  score_breakdown?: Record<string, unknown>;
  reasons?: string[];
};

export type RecommendResponse = {
  session_id?: string;
  group_user_ids?: number[] | null;
  group_aggregation?: string | null;
  context: {
    time_of_day?: string;
    day_of_week?: string;
    weather?: { condition: string; temp_c: number };
    occasion?: string;
    duration?: string;
    outing_type?: string;
    radius_km?: number;
    open_now?: boolean;
    budget?: string;
    sort_by?: string;
  };
  weight_profile?: Record<string, string>;
  diversity?: number;
  recommendations: Recommendation[];
};
/** Canonical occasions — prefer live API; fall back to static list matching configs/occasions.yaml */
export const FALLBACK_OCCASIONS = [
  { id: "first_date", label: "First Date", description: "Low-pressure conversation-friendly spots" },
  { id: "romantic", label: "Romantic", description: "Intimate and scenic" },
  { id: "anniversary", label: "Anniversary", description: "Memorable celebration" },
  { id: "brewery_tour", label: "Brewery Tour", description: "Craft beer crawl" },
  { id: "adventure", label: "Adventure", description: "Outdoors and active" },
  { id: "cultural", label: "Cultural", description: "Heritage and museums" },
  { id: "casual", label: "Casual", description: "Easygoing hangouts" },
];

export const DURATIONS = ["2-3 hours", "4-6 hours", "full day", "weekend"];
export const BUDGET_BANDS = [
  { id: "low", label: "Budget", range: "₹500–1500" },
  { id: "medium", label: "Standard", range: "₹1500–4000" },
  { id: "high", label: "Premium", range: "₹4000+" },
];

export async function fetchOccasions() {
  try {
    const res = await apiFetch("places/occasions");
    if (res.ok) {
      const data = await res.json();
      if (data.occasions?.length) return data.occasions as typeof FALLBACK_OCCASIONS;
    }
  } catch {
    /* use fallback */
  }
  return FALLBACK_OCCASIONS;
}

export type GroupRecommendation = {
  place: Place;
  score: number;
  distance_km: number;
  user_scores: Record<string, number>;
  lowest_satisfaction: number;
  reasons: string[];
};

export type GroupRecommendResponse = {
  recommendations: GroupRecommendation[];
  group_strategy: string;
  user_ids: number[];
  candidate_count: number;
  error?: string;
};

export async function fetchGroupRecommendations(params: {
  user_ids: number[];
  lat?: number;
  lng?: number;
  city?: string;
  state?: string;
  strategy?: "least_misery" | "average" | "borda";
  category?: string;
  occasion?: string;
  radius_km?: number;
}) {
  const res = await apiFetch("recommendations/group", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res;
}


export async function getSurprisePlace(params: {
  keyword?: string;
  category?: string;
  occasion?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  });
  const res = await apiFetch(`places/surprise?${q.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generatePlan(body: {
  user_id?: number;
  place_ids?: number[];
  occasion?: string;
  duration?: string;
  budget?: string;
  start_time?: string;
  lat?: number;
  lng?: number;
  area_label?: string;
  persist?: boolean;
}) {
  const res = await apiFetch("itinerary/generate-plan", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ success: boolean; data: DatePlan }>;
}

export async function refinePlan(itineraryId: number, feedback: string) {
  const res = await apiFetch(`itinerary/itineraries/${itineraryId}/refine`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getRecommendations(body: {
  user_id?: number;
  lat?: number;
  lng?: number;
  radius_km?: number;
  category?: string;
  outing_type?: string;
  occasion?: string;
  duration?: string;
  city?: string;
  state?: string;
  limit?: number;
}) {
  const res = await apiFetch("recommendations/recommendations", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type DatePlan = {
  itinerary_id?: number;
  title: string;
  description: string;
  occasion?: string;
  duration?: string;
  budget_estimate?: string;
  area_label?: string;
  romantic_tips?: string[];
  backup_plan?: string | null;
  timeline_meta?: Array<{
    time: string;
    activity: string;
    place_name?: string;
    place_id?: number;
    category?: string;
    travel_to_next?: {
      distance_km: number;
      duration_min: number;
    };
  }>;
  includes_breweries?: boolean;
  items?: Array<{
    id?: number;
    place_id: number;
    name: string;
    category?: string;
    lat: number;
    lng: number;
    arrival: string;
    departure: string;
    travel_to_next?: {
      distance_km: number;
      duration_min: number;
    };
  }>;
  places?: Array<{ id: number; name: string; category: string; lat?: number; lng?: number }>;
  routing?: {
    provider: string;
    total_distance_km: number;
    total_duration_min: number;
    legs: Array<{ distance_km: number; duration_min: number }>;
    geometry?: any;
  };
};


export async function fetchLocations(state?: string) {
  const q = state ? `?state=${encodeURIComponent(state)}` : "";
  const res = await apiFetch(`places/locations${q}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    states: string[];
    cities: Array<{ state: string; name: string; lat: number; lng: number }>;
    default_radius_km: number;
  }>;
}

export async function searchPlacesNear(params: {
  lat?: number;
  lng?: number;
  radius_km?: number;
  city?: string;
  state?: string;
  category?: string;
  q?: string;
  limit?: number;
}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  });
  const res = await apiFetch(`places/search?${q.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchInteractions(userId: number) {
  const res = await apiFetch(`interactions/users/${userId}/interactions`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchItineraries(userId?: number) {
  const q = userId ? `?user_id=${userId}` : "";
  const res = await apiFetch(`itinerary/itineraries${q}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function reorderPlan(itineraryId: number, placeIds: number[]) {
  const res = await apiFetch(`itinerary/itineraries/${itineraryId}/reorder`, {
    method: "POST",
    body: JSON.stringify({ place_ids: placeIds }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ success: boolean; data: DatePlan }>;
}

export async function swapPlanStop(itineraryId: number, oldPlaceId: number, newPlaceId: number) {
  const res = await apiFetch(`itinerary/itineraries/${itineraryId}/swap`, {
    method: "POST",
    body: JSON.stringify({ old_place_id: oldPlaceId, new_place_id: newPlaceId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ success: boolean; data: DatePlan }>;
}

export async function fetchItineraryBackups(itineraryId: number) {
  const res = await apiFetch(`itinerary/itineraries/${itineraryId}/backups`);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{
    success: boolean;
    backups: Array<{ id: number; name: string; category: string; rating?: number; cost_for_two?: number }>;
  }>;
}
