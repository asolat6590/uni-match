import crypto from "node:crypto";
import { createUser, findUserByEmail, findUserById, newId, updateUser } from "./db.js";

const COOKIE_NAME = "unimatch_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function getSecret(env) {
  return env?.AUTH_SECRET || env?.STRIPE_SECRET_KEY || "unimatch-local-dev-secret-change-in-prod";
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function readJsonBody(req, limit = 160_000) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expected, "hex");
  if (actual.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actual, expectedBuf);
}

function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token, secret) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed.uid || !parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const map = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) map[key] = decodeURIComponent(val);
  }
  return map;
}

function setSessionCookie(res, token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function issueSessionForUser(res, env, user) {
  const isPro = ["active", "trialing"].includes(user.subscriptionStatus);
  const token = signToken(
    {
      uid: user.id,
      pro: isPro,
      subId: user.stripeSubscriptionId || null,
      email: user.email || "",
      name: user.name || "UniMatch Pro",
      exp: Date.now() + SESSION_TTL_MS,
    },
    getSecret(env),
  );
  setSessionCookie(res, token);
}

export function publicUser(user) {
  if (!user) return null;
  const isPremium = ["active", "trialing"].includes(user.subscriptionStatus);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    subscriptionStatus: user.subscriptionStatus || "none",
    isPremium,
    freeMatchesUsed: user.freeMatchesUsed || 0,
    profile: user.profile || {},
    createdAt: user.createdAt,
  };
}

export function getSessionUser(req, env) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const payload = verifyToken(token, getSecret(env));
  if (!payload) return null;
  const existing = findUserById(payload.uid);
  if (existing) return existing;
  // Re-hydrate user from signed cookie across stateless serverless instances
  return createUser({
    id: payload.uid,
    email: payload.email || `${payload.uid}@unimatch.study`,
    name: payload.name || "UniMatch Pro",
    passwordHash: "",
    subscriptionStatus: payload.pro ? "active" : "none",
    stripeCustomerId: null,
    stripeSubscriptionId: payload.subId || null,
    freeMatchesUsed: 0,
    profile: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function requireUser(req, res, env) {
  const user = getSessionUser(req, env);
  if (!user) {
    sendJson(res, 403, { error: "premium_required", message: "Active UniMatch Pro subscription required." });
    return null;
  }
  return user;
}

export function requirePremium(req, res, env) {
  const user = requireUser(req, res, env);
  if (!user) return null;
  if (!["active", "trialing"].includes(user.subscriptionStatus)) {
    sendJson(res, 403, { error: "premium_required", message: "Active UniMatch Pro subscription required." });
    return null;
  }
  return user;
}

export async function handleAuth(req, res, env, subPath) {
  const secret = getSecret(env);

  if (subPath === "/me" && req.method === "GET") {
    const user = getSessionUser(req, env);
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  if (subPath === "/logout" && req.method === "POST") {
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (subPath === "/register" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      if (name.length < 2) return sendJson(res, 400, { error: "invalid", message: "Name must be at least 2 characters." });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { error: "invalid", message: "Enter a valid email." });
      if (password.length < 6) return sendJson(res, 400, { error: "invalid", message: "Password must be at least 6 characters." });
      if (findUserByEmail(email)) return sendJson(res, 409, { error: "exists", message: "An account with this email already exists." });

      const user = createUser({
        id: newId("usr"),
        email,
        name,
        passwordHash: hashPassword(password),
        subscriptionStatus: "none",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        freeMatchesUsed: 0,
        profile: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const token = signToken({ uid: user.id, exp: Date.now() + SESSION_TTL_MS }, secret);
      setSessionCookie(res, token);
      sendJson(res, 201, { user: publicUser(user) });
    } catch (err) {
      sendJson(res, err.status || 400, { error: "register_failed", message: err.message });
    }
    return;
  }

  if (subPath === "/login" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const user = findUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, { error: "invalid_credentials", message: "Invalid email or password." });
      }
      const token = signToken({ uid: user.id, exp: Date.now() + SESSION_TTL_MS }, secret);
      setSessionCookie(res, token);
      sendJson(res, 200, { user: publicUser(user) });
    } catch (err) {
      sendJson(res, err.status || 400, { error: "login_failed", message: err.message });
    }
    return;
  }

  if (subPath === "/profile" && req.method === "PATCH") {
    const user = requireUser(req, res, env);
    if (!user) return;
    try {
      const body = await readJsonBody(req);
      const nextProfile = { ...(user.profile || {}), ...(body.profile || {}) };
      const updated = updateUser(user.id, {
        name: body.name ? String(body.name).trim() : user.name,
        profile: nextProfile,
      });
      sendJson(res, 200, { user: publicUser(updated) });
    } catch (err) {
      sendJson(res, err.status || 400, { error: "profile_failed", message: err.message });
    }
    return;
  }

  sendJson(res, 404, { error: "not_found", message: "Auth endpoint not found." });
}
