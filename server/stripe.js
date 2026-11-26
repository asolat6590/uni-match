import crypto from "node:crypto";
import { createUser, findUserByEmail, findUserById, loadDb, newId, updateUser } from "./db.js";
import { getSessionUser, issueSessionForUser, publicUser, sendJson } from "./auth.js";

const STRIPE_API = "https://api.stripe.com/v1";

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5173";
  return `${proto}://${host}`;
}

async function stripeRequest(endpoint, secretKey, { method = "GET", params } = {}) {
  if (!secretKey) {
    throw Object.assign(new Error("Missing STRIPE_SECRET_KEY"), { status: 500, code: "missing_stripe_key" });
  }

  const response = await fetch(`${STRIPE_API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: params ? params.toString() : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || "Stripe API error";
    throw Object.assign(new Error(message), { status: response.status, code: data?.error?.code || "stripe_error" });
  }
  return data;
}

export async function createCheckoutSession(req, env, user) {
  const priceId = env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw Object.assign(new Error("Missing STRIPE_PRICE_ID"), { status: 500, code: "missing_price_id" });
  }

  const origin = getOrigin(req);
  const fields = {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}#pricing`,
    cancel_url: `${origin}/?checkout=cancelled#pricing`,
  };
  if (user?.id) {
    fields.client_reference_id = user.id;
    fields["metadata[userId]"] = user.id;
  }
  if (user?.stripeCustomerId) {
    fields.customer = user.stripeCustomerId;
  } else if (user?.email) {
    fields.customer_email = user.email;
  }

  const params = new URLSearchParams(fields);
  const session = await stripeRequest("/checkout/sessions", env.STRIPE_SECRET_KEY, {
    method: "POST",
    params,
  });

  if (!session.url) {
    throw Object.assign(new Error("Stripe did not return a checkout URL"), { status: 502, code: "no_checkout_url" });
  }

  return { id: session.id, url: session.url };
}

export async function syncSessionForUser(sessionId, env, currentUser, res) {
  if (!sessionId || !sessionId.startsWith("cs_")) {
    throw Object.assign(new Error("Invalid session_id"), { status: 400, code: "invalid_session" });
  }

  const session = await stripeRequest(
    `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`,
    env.STRIPE_SECRET_KEY,
  );

  if (currentUser && session.client_reference_id && session.client_reference_id !== currentUser.id) {
    throw Object.assign(new Error("Session does not belong to current user"), { status: 403, code: "forbidden" });
  }

  const paid = session.status === "complete" || session.payment_status === "paid";
  const subObj = session.subscription && typeof session.subscription === "object" ? session.subscription : null;
  const subId = subObj?.id || (typeof session.subscription === "string" ? session.subscription : null);
  const subStatus = subObj?.status || (paid ? "active" : "none");
  const stripeEmail = (session.customer_details?.email || session.customer_email || "").trim().toLowerCase();
  const stripeName = session.customer_details?.name || (stripeEmail ? stripeEmail.split("@")[0] : "UniMatch Pro");

  let targetUser = currentUser;
  if (!targetUser && paid) {
    if (session.client_reference_id) {
      targetUser = findUserById(session.client_reference_id);
    }
    if (!targetUser && stripeEmail) {
      targetUser = findUserByEmail(stripeEmail);
    }
    if (!targetUser) {
      targetUser = createUser({
        id: newId("usr"),
        email: stripeEmail || `pro_${newId("u")}@unimatch.study`,
        name: stripeName,
        passwordHash: "",
        subscriptionStatus: subStatus,
        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        stripeSubscriptionId: subId || null,
        freeMatchesUsed: 0,
        profile: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  let updated = targetUser;
  if (targetUser) {
    updated = updateUser(targetUser.id, {
      stripeCustomerId: typeof session.customer === "string" ? session.customer : targetUser.stripeCustomerId,
      stripeSubscriptionId: subId || targetUser.stripeSubscriptionId,
      subscriptionStatus: paid ? subStatus : targetUser.subscriptionStatus || "none",
    }) || targetUser;

    if (paid && res) {
      issueSessionForUser(res, env, updated);
    }
  }

  return {
    paid,
    status: session.status,
    paymentStatus: session.payment_status,
    customerEmail: stripeEmail || null,
    user: publicUser(updated),
  };
}

export async function refreshSubscriptionForUser(user, env) {
  if (!user.stripeSubscriptionId || !env.STRIPE_SECRET_KEY) {
    return user;
  }
  try {
    const sub = await stripeRequest(`/subscriptions/${encodeURIComponent(user.stripeSubscriptionId)}`, env.STRIPE_SECRET_KEY);
    return updateUser(user.id, { subscriptionStatus: sub.status || "none" }) || user;
  } catch {
    return user;
  }
}

export async function handleCheckout(req, res, env) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method", message: "POST only" });
    return;
  }
  const user = getSessionUser(req, env);

  try {
    const result = await createCheckoutSession(req, env, user);
    sendJson(res, 200, result);
  } catch (error) {
    console.error("Stripe checkout error:", error.message);
    sendJson(res, error.status || 500, {
      error: error.code || "checkout_failed",
      message: error.message || "Could not create checkout session",
    });
  }
}

export async function handleCheckoutStatus(req, res, env) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "method", message: "GET only" });
    return;
  }
  const user = getSessionUser(req, env);

  try {
    const url = new URL(req.url || "/", "http://localhost");
    const sessionId = url.searchParams.get("session_id") || "";
    const result = await syncSessionForUser(sessionId, env, user, res);
    sendJson(res, 200, result);
  } catch (error) {
    console.error("Stripe status error:", error.message);
    sendJson(res, error.status || 500, {
      error: error.code || "status_failed",
      message: error.message || "Could not verify checkout session",
    });
  }
}

export async function handleBillingStatus(req, res, env) {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "method", message: "GET only" });
    return;
  }
  const user = getSessionUser(req, env);
  if (!user) {
    sendJson(res, 200, { user: null });
    return;
  }
  const synced = await refreshSubscriptionForUser(user, env);
  sendJson(res, 200, { user: publicUser(synced) });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function verifyStripeSignature(rawBody, sigHeader, secret) {
  const parts = Object.fromEntries(
    String(sigHeader || "")
      .split(",")
      .map((kv) => kv.split("=")),
  );
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const a = Buffer.from(parts.v1);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function handleStripeWebhook(req, res, env) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method", message: "POST only" });
    return;
  }
  try {
    const rawBody = await readRawBody(req);
    if (env.STRIPE_WEBHOOK_SECRET) {
      const ok = verifyStripeSignature(rawBody, req.headers["stripe-signature"], env.STRIPE_WEBHOOK_SECRET);
      if (!ok) {
        sendJson(res, 400, { error: "invalid_signature", message: "Webhook signature mismatch" });
        return;
      }
    }

    const event = JSON.parse(rawBody || "{}");
    const obj = event?.data?.object || {};

    if (event.type === "checkout.session.completed") {
      const userId = obj.client_reference_id || obj.metadata?.userId;
      if (userId && findUserById(userId)) {
        updateUser(userId, {
          stripeCustomerId: obj.customer || null,
          stripeSubscriptionId: obj.subscription || null,
          subscriptionStatus: "active",
        });
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const db = loadDb();
      const user = db.users.find(
        (u) => u.stripeSubscriptionId === obj.id || (obj.customer && u.stripeCustomerId === obj.customer),
      );
      if (user) {
        updateUser(user.id, { subscriptionStatus: obj.status || "canceled" });
      }
    }

    sendJson(res, 200, { received: true });
  } catch (error) {
    sendJson(res, 400, { error: "webhook_error", message: error.message });
  }
}
