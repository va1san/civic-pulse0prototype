import { neon } from "@neondatabase/serverless";

let connection;
let schemaReady;

export function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  connection ||= neon(process.env.DATABASE_URL);
  return connection;
}

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = sql();
      const statements = [
        `CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          username_key TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          email_key TEXT NOT NULL UNIQUE,
          password_hash TEXT,
          google_sub TEXT UNIQUE,
          created_at BIGINT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at BIGINT NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at)`,
        `CREATE TABLE IF NOT EXISTS issues (
          id TEXT PRIMARY KEY,
          author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          author_name TEXT NOT NULL,
          category TEXT NOT NULL,
          text TEXT NOT NULL,
          photo TEXT,
          created_at BIGINT NOT NULL,
          latitude DOUBLE PRECISION NOT NULL,
          longitude DOUBLE PRECISION NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS issues_created_idx ON issues(created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS issues_author_idx ON issues(author_id, created_at DESC)`,
        `CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY,
          issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
          author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          author_name TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS comments_issue_idx ON comments(issue_id, created_at)`,
        `CREATE TABLE IF NOT EXISTS issue_impacts (
          issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          PRIMARY KEY (issue_id, user_id)
        )`,
        `CREATE TABLE IF NOT EXISTS content_reports (
          id TEXT PRIMARY KEY,
          target_type TEXT NOT NULL,
          target_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at BIGINT NOT NULL,
          status TEXT NOT NULL DEFAULT 'OPEN',
          UNIQUE(target_type, target_id, reporter_id)
        )`,
        `CREATE TABLE IF NOT EXISTS follows (
          follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at BIGINT NOT NULL,
          PRIMARY KEY (follower_id, followed_id),
          CHECK (follower_id <> followed_id)
        )`,
        `CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('follow', 'comment')),
          issue_id TEXT REFERENCES issues(id) ON DELETE CASCADE,
          comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
          created_at BIGINT NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications(recipient_id, created_at DESC)`,
        `CREATE TABLE IF NOT EXISTS auth_attempts (
          attempt_key TEXT PRIMARY KEY,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          blocked_until BIGINT NOT NULL DEFAULT 0
        )`,
      ];
      for (const statement of statements) await db.query(statement);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

export function databaseFailure(error) {
  console.error("Civic Pulse API error:", error?.message || error);
  if (String(error?.message || "").includes("DATABASE_URL is not configured")) {
    return { status: 503, message: "The shared database isn't connected yet. Please try again later." };
  }
  return { status: 500, message: "Something went wrong. Please try again." };
}
