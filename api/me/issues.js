import { ensureSchema, sql, databaseFailure } from "../_lib/db.js";
import { currentUser, checkMethod, json, fail } from "../_lib/http.js";
import { presentIssue } from "../_lib/issues.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, ["GET"])) return;
  try {
    await ensureSchema();
    const user = await currentUser(req);
    if (!user) return fail(res, 401, "Sign in to view your profile.");
    const rows = await sql().query(
      `SELECT i.*,
        (SELECT count(*) FROM issue_impacts x WHERE x.issue_id=i.id) AS impact_count,
        (SELECT count(*) FROM comments c WHERE c.issue_id=i.id) AS comment_count,
        EXISTS(SELECT 1 FROM issue_impacts x WHERE x.issue_id=i.id AND x.user_id=$1) AS you_affected
       FROM issues i WHERE i.author_id=$1 ORDER BY i.created_at DESC LIMIT 100`, [user.id]
    );
    const counts = await sql().query(
      `SELECT
        (SELECT count(*) FROM follows WHERE followed_id=$1) AS followers,
        (SELECT count(*) FROM follows WHERE follower_id=$1) AS following`, [user.id]
    );
    json(res, 200, { issues: rows.map((row) => presentIssue(row, user.id)), followers: Number(counts[0]?.followers || 0), following: Number(counts[0]?.following || 0) });
  } catch (error) {
    const e = databaseFailure(error);
    fail(res, e.status, e.message);
  }
}
