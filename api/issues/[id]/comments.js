import { randomUUID } from "node:crypto";
import { ensureSchema, sql, databaseFailure } from "../../_lib/db.js";
import { LIMITS } from "../../_lib/constants.js";
import { currentUser, checkMethod, checkSameOrigin, json, fail } from "../../_lib/http.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, ["POST"]) || !checkSameOrigin(req, res)) return;
  try {
    await ensureSchema();
    const user = await currentUser(req);
    if (!user) return fail(res, 401, "Sign in to join the discussion.");
    const issueId = String(req.query?.id || "");
    const text = String(req.body?.text || "").trim();
    if (!text) return fail(res, 400, "Write something before you post.");
    if (text.length > LIMITS.commentMax) return fail(res, 400, `Keep comments under ${LIMITS.commentMax} characters.`);
    const exists = await sql().query("SELECT id, author_id FROM issues WHERE id=$1 LIMIT 1", [issueId]);
    if (!exists.length) return fail(res, 404, "This issue is no longer available.");
    const comment = { id: `c_${randomUUID()}`, authorName: user.name, text, createdAt: Date.now() };
    await sql().query(
      "INSERT INTO comments(id,issue_id,author_id,author_name,text,created_at) VALUES($1,$2,$3,$4,$5,$6)",
      [comment.id, issueId, user.id, comment.authorName, text, comment.createdAt]
    );
    if (exists[0].author_id !== user.id) await sql().query(
      "INSERT INTO notifications(id,recipient_id,actor_id,type,issue_id,comment_id,created_at) VALUES($1,$2,$3,'comment',$4,$5,$6)",
      [`n_${randomUUID()}`, exists[0].author_id, user.id, issueId, comment.id, comment.createdAt]
    );
    json(res, 201, { comment });
  } catch (error) {
    const e = databaseFailure(error);
    fail(res, e.status, e.message);
  }
}
