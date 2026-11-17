import { createHash } from "node:crypto";
import { ensureSchema, sql, databaseFailure } from "../_lib/db.js";
import { blockedUntil, beginSession, publicUser, successfulLogin, failedLogin, verifyPassword } from "../_lib/auth.js";
import { checkMethod, checkSameOrigin, json, fail } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, ["POST"]) || !checkSameOrigin(req, res)) return;
  try {
    await ensureSchema();
    const identifier = String(req.body?.identifier || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!identifier) return fail(res, 400, "Enter your username or email.");
    if (!password) return fail(res, 400, "Enter your password.");
    const key = createHash("sha256").update(`${identifier}|${req.headers["x-forwarded-for"] || ""}`).digest("hex");
    const until = await blockedUntil(key);
    if (until > Date.now()) return fail(res, 429, `Too many tries. Wait ${Math.ceil((until - Date.now()) / 1000)} seconds and try again.`);
    const rows = await sql().query("SELECT id, username, email, password_hash, google_sub FROM users WHERE username_key=$1 OR email_key=$1 LIMIT 1", [identifier]);
    const user = rows[0];
    if (!user?.password_hash || !await verifyPassword(password, user.password_hash)) {
      await failedLogin(key);
      return fail(res, 401, "That username or password isn't right. Check them and try again.");
    }
    await successfulLogin(key);
    await beginSession(req, res, user.id);
    json(res, 200, { user: publicUser(user) });
  } catch (error) {
    const e = databaseFailure(error);
    fail(res, e.status, e.message);
  }
}
