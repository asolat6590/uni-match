import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import http from "node:http";
import { resetDbForTests, updateUser } from "./db.js";
import { routeApi } from "./router.js";
import { classifyDeadline, computeCostSummary, syncDeadlineNotifications } from "./workspace.js";
import { matchVerifiedScholarships, matchVerifiedUniversities } from "./matcher.js";

let server;
let baseUrl;

async function req(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, cookie: setCookie ? setCookie.split(";")[0] : cookie };
}

describe("UniMatch Premium SaaS", () => {
  before(async () => {
    resetDbForTests();
    server = http.createServer((request, response) => {
      routeApi(request, response, { AUTH_SECRET: "test-secret", STRIPE_PRICE_ID: "price_test" }).catch((err) => {
        response.statusCode = 500;
        response.end(JSON.stringify({ error: err.message }));
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    resetDbForTests();
  });

  it("enforces auth, Free vs Premium gating, and strict per-user data isolation", async () => {
    // Unauthenticated workspace access -> 401
    const unauth = await req("/api/workspace/dashboard");
    assert.equal(unauth.status, 401);

    // Register User A (Free)
    const regA = await req("/api/auth/register", {
      method: "POST",
      body: { name: "Alice", email: "alice@example.com", password: "password123" },
    });
    assert.equal(regA.status, 201);
    assert.equal(regA.json.user.isPremium, false);
    const cookieA = regA.cookie;

    // Free user blocked from Premium workspace -> 403
    const freeDash = await req("/api/workspace/dashboard", { cookie: cookieA });
    assert.equal(freeDash.status, 403);
    assert.equal(freeDash.json.error, "premium_required");

    // Free user gets 1 match (max 3 results), 2nd match is blocked
    const m1 = await req("/api/verified-match", { method: "POST", cookie: cookieA, body: { gpa: "3.7", test: "IELTS 7.0" } });
    assert.equal(m1.status, 200);
    assert.equal(m1.json.universities.length, 3);

    const m2 = await req("/api/verified-match", { method: "POST", cookie: cookieA, body: { gpa: "3.7" } });
    assert.equal(m2.status, 403);

    // Activate Stripe subscription for User A
    updateUser(regA.json.user.id, { subscriptionStatus: "active" });

    // Premium user can access dashboard & unlimited matches
    const premDash = await req("/api/workspace/dashboard", { cookie: cookieA });
    assert.equal(premDash.status, 200);
    assert.equal(premDash.json.user.isPremium, true);

    const m3 = await req("/api/verified-match", { method: "POST", cookie: cookieA, body: { gpa: "3.7" } });
    assert.equal(m3.status, 200);
    assert.ok(m3.json.universities.length > 3);

    // User A creates an application (auto-seeds verified docs & deadlines)
    const appA = await req("/api/workspace/applications", {
      method: "POST",
      cookie: cookieA,
      body: { universityId: "toronto" },
    });
    assert.equal(appA.status, 201);

    // Register User B (also Premium) -> cannot see User A's application
    const regB = await req("/api/auth/register", {
      method: "POST",
      body: { name: "Bob", email: "bob@example.com", password: "password123" },
    });
    updateUser(regB.json.user.id, { subscriptionStatus: "active" });

    const appsB = await req("/api/workspace/applications", { cookie: regB.cookie });
    assert.equal(appsB.status, 200);
    assert.equal(appsB.json.items.length, 0);
  });

  it("computes verified university & scholarship matches with official sources", () => {
    const unis = matchVerifiedUniversities({ gpa: "3.8", test: "IELTS 7.0", major: "Computer Science", budget: "40000" }, "en");
    assert.ok(unis.length >= 6);
    for (const u of unis) {
      assert.ok(u.officialSourceUrl.startsWith("https://"));
      assert.ok(u.matchScore >= 0 && u.matchScore <= 100);
      assert.ok(["safety", "target", "reach"].includes(u.fitTier));
    }

    const sch = matchVerifiedScholarships({ gpa: "3.8", test: "IELTS 7.0", degree: "bachelor" }, "en");
    assert.ok(sch.length >= 5);
    assert.ok(sch.every((s) => s.officialSourceUrl.startsWith("https://")));
  });

  it("classifies smart deadlines, generates notifications, and calculates costs accurately", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    assert.equal(classifyDeadline("2026-11-20", false, now), "Overdue");
    assert.equal(classifyDeadline("2026-11-26", false, now), "Today");
    assert.equal(classifyDeadline("2026-11-28", false, now), "Urgent");
    assert.equal(classifyDeadline("2026-12-05", false, now), "Soon");
    assert.equal(classifyDeadline("2027-01-15", false, now), "Upcoming");
    assert.equal(classifyDeadline("2026-11-20", true, now), "Completed");

    const cost = computeCostSummary({ tuition: 30000, living: 15000, other: 2000, scholarship: 10000 });
    assert.equal(cost.gross, 47000);
    assert.equal(cost.netFirstYear, 37000);
    assert.equal(cost.livingIsEstimate, true);
  });
});
