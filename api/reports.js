import { randomUUID } from "node:crypto";
import { ensureSchema, sql, databaseFailure } from "./_lib/db.js";
import { REPORT_REASONS } from "./_lib/constants.js";
import { currentUser, checkMethod, checkSameOrigin, json, fail } from "./_lib/http.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, ["POST"]) || !checkSameOrigin(req, res)) return;
  try {
    await ensureSchema();
    const user = await currentUser(req);
    if (!user) return fail(res, 401, "Sign in to report content.");
    const type = String(req.body?.type || "");
    const id = String(req.body?.id || "");
    const reason = String(req.body?.reason || "");
    if (!["issue", "comment"].includes(type) || !id || !REPORT_REASONS.includes(reason)) return fail(res, 400, "Choose a valid reason.");
    const target = type === "issue"
      ? await sql().query("SELECT id FROM issues WHERE id=$1 LIMIT 1", [id])
      : await sql().query("SELECT id FROM comments WHERE id=$1 LIMIT 1", [id]);
    if (!target.length) return fail(res, 404, "That content is no longer available.");
    await sql().query(
      `INSERT INTO content_reports(id,target_type,target_id,reason,reporter_id,created_at)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(target_type,target_id,reporter_id) DO NOTHING`,
      [`r_${randomUUID()}`, type, id, reason, user.id, Date.now()]
    );
    json(res, 200, { ok: true });
  } catch (error) {
    const e = databaseFailure(error);
    fail(res, e.status, e.message);
  }
}
