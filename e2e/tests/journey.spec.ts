import { test, expect } from "@playwright/test";

// Needs the dev stack running with REQUIRE_EMAIL_VERIFICATION=true, Turnstile TEST keys
// (see .env.example), Mailpit on :19080 and the curated catalog loaded.
const MAILPIT = process.env.MAILPIT_URL || "http://localhost:19080";
const API_GATEWAY = process.env.API_GATEWAY_URL || "http://localhost:19000";
const password = "correct-horse-battery-9";

async function verificationLink(request: any, email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const list = await (await request.get(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`)).json();
    if (list.messages?.length) {
      const msg = await (await request.get(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      const m = /https?:\/\/\S+\/verify-email\?token=[\w-]+/.exec(msg.Text);
      if (m) return m[0];
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("verification email never arrived");
}

test("signup -> email confirmation -> onboarding -> recommendations -> plan", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // Cannot use the dashboard without an account
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);

  // Signup (terms checkbox is mandatory)
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).toContainText("Terms of Service");
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // Login is refused until the email is confirmed
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(/confirm your email/i)).toBeVisible();

  // Confirm via the emailed link; we land in onboarding, already signed in
  await page.goto(await verificationLink(request, email));
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });

  // Onboarding: pick preferences on each step, then finish
  await page.getByRole("button", { name: /Cafés/ }).click();
  for (let i = 0; i < 6; i++) {
    const next = page.getByRole("button", { name: "Continue" });
    if (await next.isVisible()) await next.click();
  }
  await page.getByRole("button", { name: "Go to dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Session is a cookie the page's JavaScript cannot read
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "nb_session");
  expect(session?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain("nb_session");

  // Recommendations through the real API as this user
  const rec = await page.request.post(`${API_GATEWAY}/api/recommendations/recommendations`, {
    data: { lat: 12.9716, lng: 77.5946, radius_km: 20, outing_type: "friends", top_k: 5 },
    headers: { Origin: page.url().split("/dashboard")[0] },
  });
  expect(rec.status()).toBe(200);

  // Settings: delete the account, then the session is dead
  await page.goto("/dashboard/settings");
  await page.getByPlaceholder("DELETE").fill("DELETE");
  await page.getByRole("button", { name: /Permanently delete/ }).click();
  await expect(page).toHaveURL(/\/\?deleted=1/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
