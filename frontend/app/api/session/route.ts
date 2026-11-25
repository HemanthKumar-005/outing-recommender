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

/**
 * GET /api/session
 * Returns { authenticated: boolean, user_id?: number | null, email?: string | null, user?: { id, name, email, avatar } | null }
 * Validates HttpOnly nearby_token cookie server-side, checks expiration, and returns safe user data.
 * Never exposes the raw token or sensitive secrets to the client.
 */
export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get("nearby_token");

  if (!token?.value || !token.value.trim()) {
    return NextResponse.json({
      authenticated: false,
      user_id: null,
      email: null,
      user: null,
    });
  }

  let user_id: number | null = null;
  let email: string | null = null;
  let name: string | null = null;

  try {
    const parts = token.value.split(".");
    if (parts.length >= 2) {
      const payloadJson = Buffer.from(parts[1], "base64url").toString("utf-8");
      const payload = JSON.parse(payloadJson);

      // Check token expiration
      if (payload.exp && typeof payload.exp === "number") {
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec >= payload.exp) {
          // Token has expired
          return NextResponse.json({
            authenticated: false,
            user_id: null,
            email: null,
            user: null,
            error: "Session expired",
          });
        }
      }

      if (payload.user_id) user_id = Number(payload.user_id);
      if (payload.email) email = String(payload.email);
      if (payload.name) name = String(payload.name);
    }
  } catch {
    return NextResponse.json({
      authenticated: false,
      user_id: null,
      email: null,
      user: null,
    });
  }

  // Derive human-readable display name if not explicitly stored in token
  let displayName = name;
  if (!displayName && email) {
    const localPart = email.split("@")[0] || "User";
    displayName = localPart
      .replace(/[._-]+/g, " ")
      .trim()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return NextResponse.json({
    authenticated: true,
    user_id,
    email,
    user: {
      id: user_id ?? "user",
      name: displayName || "User",
      email: email || "",
      avatar: null,
    },
  });
}

/**
 * POST /api/session
 * Handles user login and registration:
 * - Accepts { email, password } for login (or { action: "register", name, email, password } for signup).
 * - Calls the real API gateway with tenant API key from cookie or env.
 * - On success, sets an HttpOnly; Secure; SameSite=Lax cookie named nearby_token.
 * - Returns { ok: true } on success, or 401 on invalid credentials.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "Missing request body" }, { status: 400 });
    }

    const cookieStore = cookies();
    const apiKey =
      body.api_key ||
      cookieStore.get("nearby_session")?.value ||
      process.env.API_KEY ||
      process.env.NEXT_PUBLIC_API_KEY ||
      "demo-key";

    const gatewayUrl = getGatewayUrl();
    const isRegister = body.action === "register";

    if (isRegister) {
      const { name, email, password } = body;
      if (!name || !email || !password) {
        return NextResponse.json(
          { ok: false, error: "Name, email, and password are required" },
          { status: 400 },
        );
      }

      let regResp: Response;
      try {
        regResp = await fetch(`${gatewayUrl}/api/users/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify({ name, email, password }),
        });
      } catch {
        const altUrl = gatewayUrl.includes("localhost")
          ? gatewayUrl.replace("localhost", "api-gateway")
          : gatewayUrl.replace("api-gateway", "localhost");
        regResp = await fetch(`${altUrl}/api/users/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          body: JSON.stringify({ name, email, password }),
        });
      }

      if (!regResp.ok) {
        const errData = await regResp.json().catch(() => ({}));
        return NextResponse.json(
          { ok: false, error: errData.detail || "Registration failed" },
          { status: regResp.status },
        );
      }
    }

    // Now log in with email and password
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required" },
        { status: 400 },
      );
    }

    let loginResp: Response;
    try {
      loginResp = await fetch(`${gatewayUrl}/api/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      const altUrl = gatewayUrl.includes("localhost")
        ? gatewayUrl.replace("localhost", "api-gateway")
        : gatewayUrl.replace("api-gateway", "localhost");
      loginResp = await fetch(`${altUrl}/api/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({ email, password }),
      });
    }

    if (!loginResp.ok) {
      const errData = await loginResp.json().catch(() => ({}));
      return NextResponse.json(
        { ok: false, error: errData.detail || "Invalid email or password" },
        { status: loginResp.status === 401 ? 401 : loginResp.status },
      );
    }

    const data = await loginResp.json();
    const token = data.access_token;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Authentication failed: no token issued" }, { status: 500 });
    }

    const isHttps = request.nextUrl.protocol === "https:";

    // Store JWT in HttpOnly; Secure (on HTTPS); SameSite=Lax cookie named nearby_token
    cookieStore.set("nearby_token", token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
    });

    // Also persist tenant API key for proxy routing
    if (apiKey) {
      cookieStore.set("nearby_session", apiKey, {
        httpOnly: true,
        secure: isHttps,
        sameSite: "lax",
        path: "/",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Session error" }, { status: 500 });
  }
}

/**
 * DELETE /api/session
 * Clears the nearby_token and nearby_session cookies.
 * Returns { ok: true }.
 */
export async function DELETE(request: NextRequest) {
  const cookieStore = cookies();
  const isHttps = request?.nextUrl?.protocol === "https:";
  cookieStore.set("nearby_token", "", {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  cookieStore.set("nearby_session", "", {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
