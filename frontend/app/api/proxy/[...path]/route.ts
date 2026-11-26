import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function getGatewayUrl(): string {
  const raw =
    process.env.INTERNAL_API_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000/api";
  return raw.replace(/\/api\/?$/, "");
}

async function handleProxy(request: NextRequest, { params }: { params: { path: string[] } }) {
  const cookieStore = cookies();
  const token = cookieStore.get("nearby_token");
  const session = cookieStore.get("nearby_session");
  const subPath = params.path ? params.path.join("/") : "";

  const isPublicEndpoint = ["recommendations/model-card", "recommendations/model-info", "model-card", "model-info"].includes(subPath);

  if (!token?.value && !session?.value && !isPublicEndpoint) {
    return NextResponse.json({ detail: "Missing or invalid session" }, { status: 401 });
  }

  const gatewayUrl = getGatewayUrl();
  const targetUrl = `${gatewayUrl}/api/${subPath}${request.nextUrl.search}`;

  const headers = new Headers();
  headers.set("Content-Type", request.headers.get("content-type") || "application/json");

  const apiKey = session?.value || process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY || "demo-key";
  headers.set("X-API-Key", apiKey);

  if (token?.value) {
    headers.set("Authorization", `Bearer ${token.value}`);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  let resp: Response;
  try {
    resp = await fetch(targetUrl, init);
  } catch {
    const altUrl = gatewayUrl.includes("localhost")
      ? gatewayUrl.replace("localhost", "api-gateway")
      : gatewayUrl.replace("api-gateway", "localhost");
    const fallbackTarget = `${altUrl}/api/${subPath}${request.nextUrl.search}`;
    resp = await fetch(fallbackTarget, init);
  }

  const data = await resp.text();
  return new NextResponse(data, {
    status: resp.status,
    headers: {
      "Content-Type": resp.headers.get("content-type") || "application/json",
    },
  });
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
