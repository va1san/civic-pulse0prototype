import { ensureSchema, sql, databaseFailure } from "../../_lib/db.js";
import { currentUser, checkMethod, checkSameOrigin, json, fail } from "../../_lib/http.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, ["POST"]) || !checkSameOrigin(req, res)) return;
  try {
    await ensureSchema();
    const user = await currentUser(req);
    if (!user) return fail(res, 401, "Sign in to say this affects you.");
    const issueId = String(req.query?.id || "");
    const exists = await sql().query("SELECT id FROM issues WHERE id=$1 LIMIT 1", [issueId]);
    if (!exists.length) return fail(res, 404, "This issue is no longer available.");
    const affected = req.body?.affected === true;
    if (affected) {
      await sql().query("INSERT INTO issue_impacts(issue_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [issueId, user.id]);
    } else {
      await sql().query("DELETE FROM issue_impacts WHERE issue_id=$1 AND user_id=$2", [issueId, user.id]);
    }
    const rows = await sql().query("SELECT count(*) AS count FROM issue_impacts WHERE issue_id=$1", [issueId]);
    json(res, 200, { impactCount: Number(rows[0].count), youAffected: affected });
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("foreign key")) return fail(res, 404, "This issue is no longer available.");
    const e = databaseFailure(error);
    fail(res, e.status, e.message);
  }
}
