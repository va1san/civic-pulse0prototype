import { ensureSchema, databaseFailure } from "../_lib/db.js";
import { currentUser, checkMethod, json, fail } from "../_lib/http.js";

export default async function handler(req, res) {
  if (!checkMethod(req, res, ["GET"])) return;
  try {
    await ensureSchema();
    json(res, 200, { user: await currentUser(req) });
  } catch (error) {
    const e = databaseFailure(error);
    fail(res, e.status, e.message);
  }
}
