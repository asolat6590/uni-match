import { routeApi } from "../server/router.js";

export default async function handler(req, res) {
  const handled = await routeApi(req, res, process.env);
  if (!handled && !res.writableEnded) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "not_found", message: "API route not found" }));
  }
}
