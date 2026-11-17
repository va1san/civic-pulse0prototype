import { ensureSchema, sql, databaseFailure } from "../_lib/db.js";
import { currentUser, checkMethod, checkSameOrigin, json, fail } from "../_lib/http.js";
import { issueById, issueComments, presentIssue } from "../_lib/issues.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, ["GET", "DELETE"])) return;
  if (req.method === "DELETE" && !checkSameOrigin(req, res)) return;
  try {
    await ensureSchema();
    const id = String(req.query?.id || "");
    const user = await currentUser(req);
    if (req.method === "GET") {
      const row = await issueById(id, user?.id || "");
      if (!row) return fail(res, 404, "We couldn't find that issue. It may have been removed.");
      const comments = await issueComments(id);
      return json(res, 200, { issue: presentIssue(row, user?.id || "", comments) });
    }
    if (!user) return fail(res, 401, "Sign in to manage your posts.");
    const rows = await sql().query("DELETE FROM issues WHERE id=$1 AND author_id=$2 RETURNING id", [id, user.id]);
    if (!rows.length) return fail(res, 404, "That post isn't available on your profile.");
    json(res, 200, { ok: true });
  } catch (error) {
    const e = databaseFailure(error);
    fail(res, e.status, e.message);
  }
}
