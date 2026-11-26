import { routeApi } from "../server/router.js";

export default async function handler(req, res) {
  try {
    const handled = await routeApi(req, res, process.env);
    if (!handled && !res.writableEnded) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "not_found", message: "API route not found" }));
    }
  } catch (err) {
    console.error("Vercel API error:", err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "server_error", message: err.message || "Internal error" }));
    }
  }
}
