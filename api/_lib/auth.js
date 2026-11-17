import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { sql } from "./db.js";
import { hashToken, setSessionCookie, SESSION_DURATION } from "./http.js";

const scrypt = promisify(scryptCb);
const RESERVED = new Set(["admin", "administrator", "moderator", "mod", "support", "civicpulse", "civic_pulse", "staff", "official", "system", "root"]);
const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function usernameProblem(raw) {
  const value = String(raw || "").trim();
  if (value.length < 3) return "Use at least 3 characters.";
  if (value.length > 20) return "Use 20 characters or fewer.";
  if (!/^[A-Za-z0-9_]+$/.test(value)) return "Use only letters, numbers and underscores.";
  if (RESERVED.has(value.toLowerCase())) return "That username is reserved. Choose another.";
  return "";
}

export function passwordProblem(password, username = "") {
  if (String(password || "").length < 8) return "Use at least 8 characters.";
  if (/^(.)\1+$/.test(password) || /^(password|12345678|qwerty123|letmein1|welcome123)$/i.test(password)) return "That password is too common. Choose something harder to guess.";
  if (username && username.length >= 3 && password.toLowerCase().includes(username.toLowerCase())) return "Your password shouldn't contain your username.";
  return "";
}

export async function makePasswordHash(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password, saved) {
  try {
    const [, saltHex, hashHex] = saved.split("$");
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
    return timingSafeEqual(expected, actual);
  } catch { return false; }
}

export async function beginSession(req, res, userId) {
  const token = randomBytes(32).toString("base64url");
  const expires = Date.now() + SESSION_DURATION;
  await sql().query("INSERT INTO sessions(token_hash, user_id, expires_at) VALUES($1, $2, $3)", [hashToken(token), userId, expires]);
  setSessionCookie(res, token, req);
}

export function publicUser(user) {
  return { id: user.id, name: user.username, username: user.username, email: user.email, provider: user.google_sub ? "google" : "password" };
}

export function requestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || "unknown";
}

export async function blockedUntil(attemptKey) {
  const rows = await sql().query("SELECT blocked_until FROM auth_attempts WHERE attempt_key=$1", [attemptKey]);
  return Number(rows[0]?.blocked_until || 0);
}

export async function failedLogin(attemptKey) {
  const now = Date.now();
  await sql().query(
    `INSERT INTO auth_attempts(attempt_key, attempt_count, blocked_until) VALUES($1, 1, 0)
     ON CONFLICT(attempt_key) DO UPDATE SET
       attempt_count = CASE WHEN auth_attempts.blocked_until > $2 THEN 1 ELSE auth_attempts.attempt_count + 1 END,
       blocked_until = CASE WHEN auth_attempts.blocked_until > $2 THEN 0 WHEN auth_attempts.attempt_count + 1 >= 5 THEN $2 + 30000 ELSE 0 END`,
    [attemptKey, now]
  );
}

export async function successfulLogin(attemptKey) {
  await sql().query("DELETE FROM auth_attempts WHERE attempt_key=$1", [attemptKey]);
}

export async function googleClaims(idToken) {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) throw new Error("Google sign-in isn't configured yet.");
  const { payload } = await jwtVerify(idToken, GOOGLE_KEYS, { audience, issuer: ["https://accounts.google.com", "accounts.google.com"] });
  if (!payload.sub || !payload.email || payload.email_verified !== true) throw new Error("Use a verified Google account to sign in.");
  return payload;
}

export function newUserId() { return `u_${randomUUID()}`; }
