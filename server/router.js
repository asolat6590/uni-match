import { handleAuth } from "./auth.js";
import { handleMatch } from "./gemini.js";
import { handleBillingStatus, handleCheckout, handleCheckoutStatus, handleStripeWebhook } from "./stripe.js";
import { handleVerifiedMatch, handleWorkspace } from "./workspace.js";

export async function routeApi(req, res, env) {
  const url = new URL(req.url || "/", "http://localhost");
  const p = url.pathname;

  if (p.startsWith("/api/auth")) {
    await handleAuth(req, res, env, p.slice("/api/auth".length) || "/");
    return true;
  }
  if (p === "/api/billing/status") {
    await handleBillingStatus(req, res, env);
    return true;
  }
  if (p === "/api/stripe-webhook") {
    await handleStripeWebhook(req, res, env);
    return true;
  }
  if (p === "/api/checkout-status") {
    await handleCheckoutStatus(req, res, env);
    return true;
  }
  if (p === "/api/checkout") {
    await handleCheckout(req, res, env);
    return true;
  }
  if (p === "/api/verified-match") {
    await handleVerifiedMatch(req, res, env);
    return true;
  }
  if (p.startsWith("/api/workspace")) {
    await handleWorkspace(req, res, env, p.slice("/api/workspace".length) || "/");
    return true;
  }
  if (p === "/api/match") {
    await handleMatch(req, res, env);
    return true;
  }

  return false;
}
