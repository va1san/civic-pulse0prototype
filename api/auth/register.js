import { randomUUID } from "node:crypto";
import { ensureSchema, sql, databaseFailure } from "../_lib/db.js";
import { beginSession, makePasswordHash, passwordProblem, publicUser, usernameProblem } from "../_lib/auth.js";
import { checkMethod, checkSameOrigin, json, fail } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, ["GET", "POST"])) return;
  try {
    await ensureSchema();
    if (req.method === "GET") {
      const username = String(req.query?.username || "").trim();
      const problem = usernameProblem(username);
      if (problem) return json(res, 200, { ok: false, reason: problem });
      const rows = await sql().query("SELECT id FROM users WHERE username_key=$1 LIMIT 1", [username.toLowerCase()]);
      return json(res, 200, rows.length ? { ok: false, reason: "That username is taken." } : { ok: true });
    }
    if (!checkSameOrigin(req, res)) return;
    const username = String(req.body?.username || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const uError = usernameProblem(username);
    if (uError) return fail(res, 400, uError);
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return fail(res, 400, "Enter a valid email address.");
    const pError = passwordProblem(password, username);
    if (pError) return fail(res, 400, pError);
    const exists = await sql().query("SELECT id FROM users WHERE username_key=$1 OR email_key=$2 LIMIT 1", [username.toLowerCase(), email]);
    if (exists.length) return fail(res, 409, "That username or email is already registered.");
    const user = { id: `u_${randomUUID()}`, username, email, password_hash: await makePasswordHash(password) };
    await sql().query(
      `INSERT INTO users(id, username, username_key, email, email_key, password_hash, created_at)
       VALUES($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, username, username.toLowerCase(), email, email, user.password_hash, Date.now()]
    );
    await beginSession(req, res, user.id);
    json(res, 201, { user: publicUser(user) });
  } catch (error) {
    const e = databaseFailure(error);
    fail(res, e.status, e.message);
  }
}
