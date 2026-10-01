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

export function getUserInfo() {
  if (typeof window === "undefined") {
    return { name: "Guest", workspace: "Demo", email: "" };
  }
  return {
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

export type Recommendation = {
  place: {
    id: number;
    name: string;
    category: string;
    price_range: number;
    distance_km: number;
    rating?: number;
  };
  score: number;
  score_breakdown: Record<string, unknown>;
  reasons: string[];
};

export type RecommendResponse = {
  session_id: string;
  group_user_ids: number[] | null;
  group_aggregation: string | null;
  context: {
    time_of_day: string;
    day_of_week: string;
    weather: { condition: string; temp_c: number };
  };
  weight_profile: Record<string, string>;
  diversity: number;
  recommendations: Recommendation[];
};