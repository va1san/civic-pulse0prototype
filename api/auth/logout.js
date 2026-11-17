import { ensureSchema, sql, databaseFailure } from "../_lib/db.js";
import { clearSessionCookie, hashToken, readCookie, checkMethod, checkSameOrigin, json, fail } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, ["POST"]) || !checkSameOrigin(req, res)) return;
  try {
    await ensureSchema();
    const token = readCookie(req);
    if (token) await sql().query("DELETE FROM sessions WHERE token_hash=$1", [hashToken(token)]);
    clearSessionCookie(res, req);
    json(res, 200, { ok: true });
  } catch (error) {
    const e = databaseFailure(error);
    clearSessionCookie(res, req);
    fail(res, e.status, e.message);
  }
}
