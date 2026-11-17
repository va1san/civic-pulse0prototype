import { sql } from "./db.js";

const approx = (n) => Math.round(Number(n) * 1000) / 1000;

export function presentIssue(row, userId = "", comments = []) {
  return {
    id: row.id,
    authorName: row.author_name,
    category: row.category,
    text: row.text,
    photo: row.photo,
    createdAt: Number(row.created_at),
    location: { lat: approx(row.latitude), lng: approx(row.longitude) },
    impactCount: Number(row.impact_count || 0),
    youAffected: Boolean(userId && row.you_affected),
    commentCount: Number(row.comment_count || 0),
    comments,
  };
}

export async function issueById(id, userId = "") {
  const rows = await sql().query(
    `SELECT i.*,
      (SELECT count(*) FROM issue_impacts x WHERE x.issue_id=i.id) AS impact_count,
      (SELECT count(*) FROM comments c WHERE c.issue_id=i.id) AS comment_count,
      EXISTS(SELECT 1 FROM issue_impacts x WHERE x.issue_id=i.id AND x.user_id=$2) AS you_affected
     FROM issues i WHERE i.id=$1 LIMIT 1`, [id, userId || ""]
  );
  return rows[0] || null;
}

export async function listIssues(sort = "newest", userId = "") {
  const order = sort === "oldest" ? "i.created_at ASC" : sort === "affected" ? "impact_count DESC, i.created_at DESC" : "i.created_at DESC";
  const rows = await sql().query(
    `SELECT i.*,
      (SELECT count(*) FROM issue_impacts x WHERE x.issue_id=i.id) AS impact_count,
      (SELECT count(*) FROM comments c WHERE c.issue_id=i.id) AS comment_count,
      EXISTS(SELECT 1 FROM issue_impacts x WHERE x.issue_id=i.id AND x.user_id=$1) AS you_affected
     FROM issues i ORDER BY ${order} LIMIT 100`, [userId || ""]
  );
  return rows.map((row) => presentIssue(row, userId));
}

export async function issueComments(issueId) {
  return sql().query(
    `SELECT id, author_name, text, created_at FROM comments WHERE issue_id=$1 ORDER BY created_at ASC`, [issueId]
  ).then((rows) => rows.map((c) => ({ id: c.id, authorName: c.author_name, text: c.text, createdAt: Number(c.created_at) })));
}
