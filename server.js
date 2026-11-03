import http from "node:http";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleMatch } from "./server/gemini.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");

function loadDotEnv() {
  const file = path.join(root, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

function safeFile(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const filePath = path.normalize(path.join(dist, decoded));
  if (!filePath.startsWith(dist)) return null;
  return filePath;
}

const port = Number(process.env.PORT) || 4173;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/match") {
    handleMatch(req, res, process.env);
    return;
  }

  let filePath = safeFile(url.pathname) || path.join(dist, "index.html");
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, "index.html");
  } catch {
    filePath = path.join(dist, "index.html");
  }

  res.setHeader("Content-Type", types[path.extname(filePath)] || "application/octet-stream");
  createReadStream(filePath)
    .on("error", () => {
      res.statusCode = 404;
      res.end("Not found");
    })
    .pipe(res);
});

server.listen(port, () => {
  console.log(`UniMatch http://localhost:${port}`);
});
