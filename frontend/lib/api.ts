const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export function getApiUrl(): string {
  return DEFAULT_API_URL;
}

/** Gateway root (the API URL without its trailing /api). Auth endpoints live here. */
function gatewayBase(): string {
  return getApiUrl().replace(/\/api\/?$/, "");
}

// ---------------------------------------------------------------------------
// Session handling
//
// The real session is an HttpOnly cookie set by the gateway: JavaScript cannot read it,
// so XSS cannot steal it. The small profile cache below (id, name, email) is NOT a
// credential; it only lets the UI render synchronously. The server re-checks the
// cookie on every request, and the dashboard calls /auth/me on load.
// ---------------------------------------------------------------------------
export type SessionUser = {
  id: number;
  name: string;
  email: string;
  email_verified_at?: string | null;
  location_consent_at?: string | null;
  role?: string;
};

const USER_CACHE_KEY = "nearby_user";

function cacheUser(user: SessionUser | null) {
  if (typeof window === "undefined") return;
  if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_CACHE_KEY);
}

function readCachedUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  for (const k of ["nearby_user", "nearby_onboarded", "nearby_preferences"]) localStorage.removeItem(k);
}

/** UI hint only. Authorisation is always enforced server-side. */
export function isAuthenticated(): boolean {
  return readCachedUser() !== null;
}

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("nearby_onboarded") === "true";
}

export function getUserInfo(): { id: number; name: string; email: string } {
  const u = readCachedUser();
  return { id: u?.id ?? 0, name: u?.name || "there", email: u?.email || "" };
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${getApiUrl().replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...options, headers, credentials: "include" });
  if (res.status === 401 && typeof window !== "undefined" && isAuthenticated()) {
    // Session expired or account deleted: drop the stale cache and go to login.
    clearSession();
    window.location.href = "/login";
  }
  return res;
}

async function authPost(path: string, body: unknown) {
  const res = await fetch(`${gatewayBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
  return data;
}

export async function signupUser(p: { name: string; email: string; password: string; acceptTerms: boolean; captchaToken?: string }) {
  return authPost("/auth/signup", {
    name: p.name, email: p.email, password: p.password, accept_terms: p.acceptTerms, captcha_token: p.captchaToken,
  }) as Promise<{ status: string; verification_required: boolean }>;
}

export async function loginUser(p: { email: string; password: string; captchaToken?: string }) {
  const data = (await authPost("/auth/login", { email: p.email, password: p.password, captcha_token: p.captchaToken })) as { user: SessionUser };
  cacheUser(data.user);
  return data.user;
}

export async function verifyEmailToken(token: string) {
  const data = (await authPost("/auth/verify-email", { token })) as { user: SessionUser };
  cacheUser(data.user);
  return data.user;
}

export async function resendVerification(p: { email: string; password: string; captchaToken?: string }) {
  return authPost("/auth/resend-verification", { email: p.email, password: p.password, captcha_token: p.captchaToken });
}

/** Ask the server who we are. Returns null when not signed in. */
export async function fetchMe(): Promise<SessionUser | null> {
  try {
    const res = await fetch(`${gatewayBase()}/auth/me`, { credentials: "include" });
    if (!res.ok) {
      if (res.status === 401) cacheUser(null);
      return null;
    }
    const data = await res.json();
    cacheUser(data.user);
    return data.user as SessionUser;
  } catch {
    return readCachedUser();
  }
}

export async function logoutUser() {
  try {
    await fetch(`${gatewayBase()}/auth/logout`, { method: "POST", credentials: "include" });
  } finally {
    clearSession();
  }
}

export async function deleteMyAccount() {
  const res = await apiFetch("users/users/me", { method: "DELETE" });
  if (!res.ok) throw new Error("Could not delete your account. Please try again.");
  clearSession();
}

export async function setLocationConsent(granted: boolean) {
  const res = await apiFetch("users/users/me/consent", { method: "POST", body: JSON.stringify({ location: granted }) });
  if (!res.ok) throw new Error("Could not save your choice.");
  const user = (await res.json()) as SessionUser;
  cacheUser(user);
  return user;
}

export async function reportPlaceIssue(placeId: number, issueType: string, details = "") {
  const res = await apiFetch(`places/places/${placeId}/report`, {
    method: "POST",
    body: JSON.stringify({ issue_type: issueType, details }),
  });
  if (!res.ok) throw new Error("Could not send your report.");
  return res.json();
}

export async function shareItinerary(itineraryId: number) {
  const res = await apiFetch(`itinerary/itineraries/${itineraryId}/share`, { method: "POST" });
  if (!res.ok) throw new Error("Could not create a share link.");
  return (await res.json()) as { share_token: string; path: string };
}

export function itineraryCalendarUrl(itineraryId: number): string {
  return `${getApiUrl().replace(/\/$/, "")}/itinerary/itineraries/${itineraryId}/calendar.ics`;
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
  hours_is_estimated?: boolean;
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
