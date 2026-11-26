import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "unimatch-data")
  : path.resolve(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "unimatch.json");

const EMPTY_DB = () => ({
  users: [],
  applications: [],
  tasks: [],
  deadlines: [],
  notifications: [],
  essays: [],
  documents: [],
  savedUniversities: [],
  scholarships: [],
  costCalculations: [],
});

let cache = null;

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function loadDb() {
  if (cache) return cache;
  ensureDir();
  if (!existsSync(DB_FILE)) {
    cache = EMPTY_DB();
    saveDb(cache);
    return cache;
  }
  try {
    const raw = readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);
    cache = { ...EMPTY_DB(), ...parsed };
  } catch {
    cache = EMPTY_DB();
  }
  return cache;
}

export function saveDb(next = cache) {
  if (!next) return;
  ensureDir();
  cache = next;
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
  renameSync(tmp, DB_FILE);
}

export function resetDbForTests() {
  cache = EMPTY_DB();
  saveDb(cache);
}

export function newId(prefix = "id") {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function findUserByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return loadDb().users.find((u) => u.email === normalized) || null;
}

export function findUserById(id) {
  return loadDb().users.find((u) => u.id === id) || null;
}

export function createUser(user) {
  const db = loadDb();
  db.users.push(user);
  saveDb(db);
  return user;
}

export function updateUser(id, patch) {
  const db = loadDb();
  const idx = db.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  db.users[idx] = { ...db.users[idx], ...patch, updatedAt: new Date().toISOString() };
  saveDb(db);
  return db.users[idx];
}

export function listForUser(collection, userId) {
  const db = loadDb();
  const items = db[collection];
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item.userId === userId);
}

export function insertForUser(collection, userId, record) {
  const db = loadDb();
  if (!Array.isArray(db[collection])) throw new Error(`Unknown collection: ${collection}`);
  const now = new Date().toISOString();
  const item = {
    id: record.id || newId(collection.slice(0, 3)),
    ...record,
    userId,
    createdAt: record.createdAt || now,
    updatedAt: now,
  };
  db[collection].push(item);
  saveDb(db);
  return item;
}

export function updateForUser(collection, userId, id, patch) {
  const db = loadDb();
  const items = db[collection];
  if (!Array.isArray(items)) return null;
  const idx = items.findIndex((item) => item.id === id && item.userId === userId);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...patch, userId, updatedAt: new Date().toISOString() };
  saveDb(db);
  return items[idx];
}

export function removeForUser(collection, userId, id) {
  const db = loadDb();
  const items = db[collection];
  if (!Array.isArray(items)) return false;
  const before = items.length;
  db[collection] = items.filter((item) => !(item.id === id && item.userId === userId));
  if (db[collection].length === before) return false;
  saveDb(db);
  return true;
}
