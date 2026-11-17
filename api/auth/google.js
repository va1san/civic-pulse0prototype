import { ensureSchema, sql, databaseFailure } from "../_lib/db.js";
import { beginSession, googleClaims, newUserId, publicUser, usernameProblem } from "../_lib/auth.js";
import { checkMethod, checkSameOrigin, json, fail } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, ["POST"]) || !checkSameOrigin(req, res)) return;
  try {
    await ensureSchema();
    let claims;
    try { claims = await googleClaims(String(req.body?.credential || "")); }
    catch (error) { return fail(res, 401, error?.message || "Google sign-in couldn't be verified. Try again or use a password."); }
    const email = String(claims.email).toLowerCase();
    let rows = await sql().query("SELECT id, username, email, google_sub FROM users WHERE google_sub=$1 OR email_key=$2 LIMIT 1", [claims.sub, email]);
    let user = rows[0];
    if (user) {
      if (user.google_sub && user.google_sub !== claims.sub) return fail(res, 409, "That email is linked to a different Google account.");
      if (!user.google_sub) await sql().query("UPDATE users SET google_sub=$1 WHERE id=$2", [claims.sub, user.id]);
      user.google_sub = claims.sub;
    } else {
      const username = String(req.body?.username || "").trim();
      if (!username) return json(res, 200, { setupRequired: true, email });
      const usernameError = usernameProblem(username);
      if (usernameError) return fail(res, 400, usernameError);
      const existingName = await sql().query("SELECT id FROM users WHERE username_key=$1 LIMIT 1", [username.toLowerCase()]);
      if (existingName.length) return fail(res, 409, "That username is taken. Choose another.");
      user = { id: newUserId(), username, email, google_sub: claims.sub };
      await sql().query(
        `INSERT INTO users(id, username, username_key, email, email_key, google_sub, created_at)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [user.id, username, username.toLowerCase(), email, email, claims.sub, Date.now()]
      );
    }
    await beginSession(req, res, user.id);
    json(res, 200, { user: publicUser(user) });
  } catch (error) {
    const e = databaseFailure(error);
    fail(res, e.status, e.message);
  }
}
