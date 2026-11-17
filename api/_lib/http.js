import { createHash } from "node:crypto";
import { ensureSchema, sql } from "./db.js";

const COOKIE = "civicpulse_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function json(res, status, value) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(value));
}

export function fail(res, status, message) {
  json(res, status, { error: message });
}

export function checkMethod(req, res, allowed) {
  if (!allowed.includes(req.method)) {
    res.setHeader("Allow", allowed.join(", "));
    fail(res, 405, "That action isn't available.");
    return false;
  }
  return true;
}

export function checkSameOrigin(req, res) {
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!origin || !host) return fail(res, 403, "This request could not be verified. Refresh the page and try again.");
  try {
    const url = new URL(origin);
    if (url.host.toLowerCase() !== String(host).toLowerCase() || !["https:", "http:"].includes(url.protocol)) {
      return fail(res, 403, "This request could not be verified. Refresh the page and try again.");
    }
  } catch {
    return fail(res, 403, "This request could not be verified. Refresh the page and try again.");
  }
  return true;
}

export function readCookie(req, name = COOKIE) {
  const header = req.headers.cookie || "";
  const item = header.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function setSessionCookie(res, token, req) {
  const secure = req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}${secure ? "; Secure" : ""}`);
}

export function clearSessionCookie(res, req) {
  const secure = req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`);
}

export async function currentUser(req) {
  await ensureSchema();
  const token = readCookie(req);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const rows = await sql().query(
    `SELECT u.id, u.username, u.email, u.google_sub, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 LIMIT 1`, [tokenHash]
  );
  const row = rows[0];
  if (!row) return null;
  if (Number(row.expires_at) < Date.now()) {
    await sql().query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
    return null;
  }
  return { id: row.id, name: row.username, username: row.username, email: row.email, provider: row.google_sub ? "google" : "password" };
}

export async function requireUser(req, res) {
  const user = await currentUser(req);
  if (!user) fail(res, 401, "Sign in to continue.");
  return user;
}

export const SESSION_DURATION = SESSION_MS;
export const SESSION_COOKIE = COOKIE;
