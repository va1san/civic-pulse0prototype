import { randomUUID } from "node:crypto";
import { ensureSchema, sql, databaseFailure } from "../_lib/db.js";
import { CATEGORIES, LIMITS } from "../_lib/constants.js";
import { currentUser, checkMethod, checkSameOrigin, json, fail } from "../_lib/http.js";
import { listIssues } from "../_lib/issues.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, ["GET", "POST"])) return;
  if (req.method === "POST" && !checkSameOrigin(req, res)) return;
  try {
    await ensureSchema();
    const user = await currentUser(req);
    if (req.method === "GET") return json(res, 200, { issues: await listIssues(String(req.query?.sort || "newest"), user?.id || "") });
    if (!user) return fail(res, 401, "Sign in to post an issue.");
    const text = String(req.body?.text || "").trim();
    const category = String(req.body?.category || "");
    const location = req.body?.location || {};
    const lat = Number(location.lat), lng = Number(location.lng);
    const photo = req.body?.photo || null;
    if (text.length < LIMITS.issueMin) return fail(res, 400, `Describe the issue in at least ${LIMITS.issueMin} characters.`);
    if (text.length > LIMITS.issueMax) return fail(res, 400, `Keep the description under ${LIMITS.issueMax} characters.`);
    if (!CATEGORIES.includes(category)) return fail(res, 400, "Choose a category.");
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return fail(res, 400, "Choose a valid location on the map.");
    }
    if (photo && (typeof photo !== "string" || !/^data:image\/(jpeg|png|webp);base64,/.test(photo) || photo.length > 1200000)) {
      return fail(res, 400, "That photo is too large or isn't a supported image.");
    }
    const id = `i_${randomUUID()}`;
    const createdAt = Date.now();
    await sql().query(
      `INSERT INTO issues(id,author_id,author_name,category,text,photo,created_at,latitude,longitude)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, user.id, user.name, category, text, photo, createdAt, lat, lng]
    );
    json(res, 201, { issue: { id, authorName: user.name, category, text, photo, createdAt, location: { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000 }, impactCount: 0, youAffected: false, commentCount: 0, comments: [] } });
  } catch (error) {
    const e = databaseFailure(error);
    fail(res, e.status, e.message);
  }
}
