import { matchProfile } from "../server/gemini.js";

function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try {
      return Promise.resolve(req.body ? JSON.parse(req.body) : {});
    } catch {
      return Promise.reject(Object.assign(new Error("Invalid JSON"), { status: 400, code: "invalid" }));
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 80_000) {
        reject(Object.assign(new Error("Payload too large"), { status: 413, code: "too_large" }));
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
        reject(Object.assign(new Error("Invalid JSON"), { status: 400, code: "invalid" }));
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const lang = req.headers["x-unimatch-lang"] === "en" ? "en" : "ru";
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "method", message: "POST only" }));
    return;
  }

  try {
    const result = await matchProfile(await readBody(req), process.env);
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (error) {
    if (error.detail) console.error("Gemini error:", error.detail);
    else if (!error.status) console.error(error);
    res.statusCode = error.status || 500;
    res.end(
      JSON.stringify({
        error: error.code || "match_failed",
        message:
          error.message ||
          (lang === "en"
            ? "Could not match universities. Please try again."
            : "Не получилось подобрать университеты. Попробуй ещё раз."),
      }),
    );
  }
}
