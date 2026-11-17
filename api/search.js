import { randomUUID } from "node:crypto";
import { ensureSchema, sql, databaseFailure } from "./_lib/db.js";
import { presentIssue } from "./_lib/issues.js";
import { currentUser, checkMethod, checkSameOrigin, json, fail } from "./_lib/http.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, ["GET", "POST"])) return;
  if (req.method === "POST" && !checkSameOrigin(req, res)) return;
  try {
    await ensureSchema();
    if (req.query?.notifications === "1") {
      const viewer = await currentUser(req);
      if (!viewer) return fail(res, 401, "Sign in to view notifications.");
      const rows = await sql().query(
        `SELECT n.id, n.type, n.created_at, actor.username AS actor_username,
                i.id AS issue_id, i.text AS issue_text, i.category AS issue_category
         FROM notifications n
         JOIN users actor ON actor.id=n.actor_id
         LEFT JOIN issues i ON i.id=n.issue_id
         WHERE n.recipient_id=$1
         ORDER BY n.created_at DESC
         LIMIT 100`, [viewer.id]
      );
      return json(res, 200, { notifications: rows.map((row) => ({
        id: row.id, type: row.type, actorUsername: row.actor_username,
        createdAt: Number(row.created_at), issueId: row.issue_id || null,
        issueText: row.issue_text || null, category: row.issue_category || null,
      })) });
    }
    if (req.method === "POST") {
      const viewer = await currentUser(req);
      if (!viewer) return fail(res, 401, "Sign in to follow community members.");
      const username = String(req.body?.username || "").trim();
      const shouldFollow = req.body?.follow;
      if (!username || typeof shouldFollow !== "boolean") return fail(res, 400, "Choose an account to follow or unfollow.");
      const targets = await sql().query("SELECT id FROM users WHERE username_key=$1 LIMIT 1", [username.toLowerCase()]);
      if (!targets.length) return fail(res, 404, "That account could not be found.");
      const targetId = targets[0].id;
      if (targetId === viewer.id) return fail(res, 400, "You can’t follow your own account.");
      if (shouldFollow) {
        const created = await sql().query(
          "INSERT INTO follows(follower_id, followed_id, created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING follower_id",
          [viewer.id, targetId, Date.now()]
        );
        if (created.length) await sql().query(
          "INSERT INTO notifications(id,recipient_id,actor_id,type,created_at) VALUES($1,$2,$3,'follow',$4)",
          [`n_${randomUUID()}`, targetId, viewer.id, Date.now()]
        );
      } else {
        await sql().query("DELETE FROM follows WHERE follower_id=$1 AND followed_id=$2", [viewer.id, targetId]);
      }
      const stats = await sql().query(
        `SELECT (SELECT count(*) FROM follows WHERE followed_id=$1)::int AS followers,
                EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND followed_id=$1) AS is_following`,
        [targetId, viewer.id]
      );
      return json(res, 200, { isFollowing: !!stats[0]?.is_following, followers: Number(stats[0]?.followers || 0) });
    }
    const username = String(req.query?.username || "").trim();
    if (username) {
      const users = await sql().query("SELECT id, username FROM users WHERE username_key=$1 LIMIT 1", [username.toLowerCase()]);
      if (!users.length) return fail(res, 404, "That account could not be found.");
      const profileUser = users[0];
      const viewer = await currentUser(req);
      const [stats, issues] = await Promise.all([
        sql().query(
          `SELECT (SELECT count(*) FROM issues WHERE author_id=$1)::int AS post_count,
                  (SELECT count(*) FROM follows WHERE followed_id=$1)::int AS followers,
                  (SELECT count(*) FROM follows WHERE follower_id=$1)::int AS following,
                  EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND followed_id=$1) AS is_following`,
          [profileUser.id, viewer?.id || ""]
        ),
        sql().query(
          `SELECT i.*,
             (SELECT count(*) FROM issue_impacts x WHERE x.issue_id=i.id) AS impact_count,
             (SELECT count(*) FROM comments c WHERE c.issue_id=i.id) AS comment_count,
             EXISTS(SELECT 1 FROM issue_impacts x WHERE x.issue_id=i.id AND x.user_id=$2) AS you_affected
           FROM issues i WHERE i.author_id=$1 ORDER BY i.created_at DESC LIMIT 100`,
          [profileUser.id, viewer?.id || ""]
        ),
      ]);
      const counts = stats[0] || {};
      return json(res, 200, {
        profile: {
          username: profileUser.username,
          postCount: Number(counts.post_count || 0),
          followers: Number(counts.followers || 0),
          following: Number(counts.following || 0),
          isFollowing: !!counts.is_following,
          isSelf: !!viewer && viewer.id === profileUser.id,
          issues: issues.map((row) => presentIssue(row, viewer?.id || "")),
        },
      });
    }
    const query = String(req.query?.q || "").trim().slice(0, 80);
    if (query.length < 2) return json(res, 200, { users: [], issues: [] });
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const viewer = await currentUser(req);
    const users = await sql().query(
      `SELECT u.username, count(i.id)::int AS post_count
       FROM users u LEFT JOIN issues i ON i.author_id=u.id
       WHERE u.username_key ILIKE $1
       GROUP BY u.id
       ORDER BY (u.username_key=lower($2)) DESC, u.username_key ASC
       LIMIT 20`,
      [pattern, query]
    );
    const rows = await sql().query(
      `SELECT i.*,
         (SELECT count(*) FROM issue_impacts x WHERE x.issue_id=i.id) AS impact_count,
         (SELECT count(*) FROM comments c WHERE c.issue_id=i.id) AS comment_count,
         EXISTS(SELECT 1 FROM issue_impacts x WHERE x.issue_id=i.id AND x.user_id=$2) AS you_affected
       FROM issues i JOIN users u ON u.id=i.author_id
       WHERE i.text ILIKE $1 OR i.category ILIKE $1 OR u.username_key ILIKE $1
       ORDER BY i.created_at DESC
       LIMIT 50`,
      [pattern, viewer?.id || ""]
    );
    json(res, 200, {
      users: users.map((user) => ({ username: user.username, postCount: Number(user.post_count || 0) })),
      issues: rows.map((row) => presentIssue(row, viewer?.id || "")),
    });
  } catch (error) {
    const e = databaseFailure(error);
    fail(res, e.status, e.message);
  }
}
