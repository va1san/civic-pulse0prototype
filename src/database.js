// DATABASE: data layer. Currently a browser-only mock (localStorage). Each function maps to one REST endpoint;
// swap the bodies for fetch("/api/...") when the Express + PostgreSQL backend is ready.
// Mock API that runs in the browser (localStorage). Every function mirrors a REST endpoint,
// so when the Express backend is ready, replace the body of each one with a fetch("/api/...") call.
// Nothing here is secure: auth, roles, rate limits and moderation belong on the server.

export const CATEGORIES = [
  "Roads and footpaths",
  "Streetlights",
  "Waste and cleanliness",
  "Drainage and water",
  "Parks and public spaces",
  "Traffic and parking",
  "Something else",
];

export const REPORT_REASONS = [
  "Spam or advertising",
  "Abusive or hateful",
  "Private or unsafe information",
  "Something else",
];

export const LIMITS = { issueMin: 10, issueMax: 500, commentMax: 600, photoMB: 5, passwordMin: 8 };

// Demo area (illustrative map). Real bounds come with the map provider decision.
export const BOUNDS = { north: 12.945, south: 12.915, west: 77.575, east: 77.605 };

export class ApiError extends Error {
  constructor(message, field = "form") {
    super(message);
    this.field = field;
  }
}

const KEY = "civicpulse.v1";
const SEED_CLEANUP_KEY = "civicpulse.seed-posts-removed.v1";
const SESSION = "civicpulse.session";
const USER_CACHE = "civicpulse.user.v1";
// The shared API is opt-in until this Vercel project has a database attached.
const remoteMode = import.meta.env.PROD && import.meta.env.VITE_USE_REMOTE_API === "true";
const wait = (ms = 140) => new Promise((r) => setTimeout(r, ms));

async function apiRequest(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  let result = {};
  try { result = await response.json(); } catch { /* Keep a useful fallback message below. */ }
  if (!response.ok) throw new ApiError(result.error || "We couldn't complete that request. Please try again.");
  return result;
}

function cacheRemoteUser(user) {
  try {
    if (user) sessionStorage.setItem(USER_CACHE, JSON.stringify(user));
    else sessionStorage.removeItem(USER_CACHE);
  } catch { /* Session cookies remain the source of truth. */ }
  return user;
}

export async function getSessionUser() {
  if (!remoteMode) return currentUser();
  const { user } = await apiRequest("/api/auth/me");
  return cacheRemoteUser(user || null);
}

function seed() {
  return { users: [], reports: [], issues: [], follows: [] };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw);
      if (!Array.isArray(db.follows)) db.follows = [];
      // Clear illustrative starter reports once without touching reports made by residents.
      if (!localStorage.getItem(SEED_CLEANUP_KEY)) {
        const existing = Array.isArray(db.issues) ? db.issues : [];
        const realIssues = existing.filter((issue) => !String(issue.authorId || "").startsWith("seed-"));
        let saved = true;
        if (realIssues.length !== existing.length) {
          db.issues = realIssues;
          try { save(db); } catch { saved = false; /* The returned view is still clean if storage is full. */ }
        }
        if (saved) {
          try { localStorage.setItem(SEED_CLEANUP_KEY, "1"); } catch { /* The migration can safely be retried next time. */ }
        }
      }
      return db;
    }
  } catch {
    /* fall through to seed */
  }
  const s = seed();
  try {
    save(s);
  } catch {
    /* storage unavailable: keep working with in-memory seed data */
  }
  return s;
}

function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new ApiError("Your browser has no space left to save this. Try removing the photo.");
  }
}

// Public coordinates are rounded (~110 m) so exact spots are not exposed.
const approx = (n) => Math.round(n * 1000) / 1000;
const toPublic = (i, userId) => ({
  id: i.id,
  authorName: i.authorName,
  category: i.category,
  text: i.text,
  photo: i.photo,
  createdAt: i.createdAt,
  location: { lat: approx(i.location.lat), lng: approx(i.location.lng) },
  impactCount: i.impact.length,
  youAffected: !!userId && i.impact.includes(userId),
  commentCount: i.comments.length,
  comments: i.comments,
});

// ---------------------------------------------------------------------------------------------
// ACCOUNTS (mock). Real version: POST /api/auth/register, /api/auth/login, /api/auth/google, /api/auth/logout.
// The server must hash passwords (argon2id or bcrypt), issue an httpOnly session cookie, rate limit these
// routes, and verify Google ID tokens with Google's public keys. Nothing here is secure on its own.
// ---------------------------------------------------------------------------------------------
const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const GOOGLE_CLIENT_ID = window.__CONFIG__?.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID;

async function hashPassword(password, saltHex) {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g).map((h) => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, key, 256);
  return { salt: toHex(salt), hash: toHex(bits) };
}

const RESERVED = ["admin", "administrator", "moderator", "mod", "support", "civicpulse", "civic_pulse", "staff", "official", "system", "root"];
const COMMON_PASSWORDS = [
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword",
  "12345678", "123456789", "1234567890", "123123123", "987654321", "11111111", "00000000", "qwerty123", "qwertyui",
  "qwertyuiop", "qwerty12", "iloveyou", "abc12345", "abcd1234", "letmein1", "welcome1", "welcome123", "admin123",
  "administrator", "changeme", "monkey123", "dragon123", "football1", "baseball1", "sunshine1", "princess1",
  "whatever1", "trustno1", "india123", "india@123", "bangalore", "bengaluru",
];

export function usernameProblem(raw) {
  const u = (raw || "").trim();
  if (u.length < 3) return "Use at least 3 characters.";
  if (u.length > 20) return "Use 20 characters or fewer.";
  if (!/^[A-Za-z0-9_]+$/.test(u)) return "Use only letters, numbers and underscores.";
  if (RESERVED.includes(u.toLowerCase())) return "That username is reserved. Choose another.";
  return "";
}

export function passwordProblem(password, username = "") {
  if ((password || "").length < LIMITS.passwordMin) return `Use at least ${LIMITS.passwordMin} characters.`;
  if (COMMON_PASSWORDS.includes(password.toLowerCase()) || /^(.)\1+$/.test(password)) return "That password is too common. Choose something harder to guess.";
  if (username && password.toLowerCase().includes(username.toLowerCase()) && username.length >= 3) return "Your password shouldn't contain your username.";
  return "";
}

// 0 = too short, 1 = weak, 2 = good, 3 = strong. Guidance only; passwordProblem() is the actual rule.
export function passwordStrength(pw = "") {
  if (pw.length < LIMITS.passwordMin) return { score: 0, label: "Too short" };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  let score = 1;
  if (pw.length >= 12 || classes >= 3) score = 2;
  if (pw.length >= 12 && classes >= 3) score = 3;
  return { score, label: ["Too short", "Weak", "Good", "Strong"][score] };
}

const userView = (u) => ({ id: u.id, name: u.username, username: u.username, email: u.email, provider: u.googleSub ? "google" : "password" });

export function currentUser() {
  if (remoteMode) {
    try { return JSON.parse(sessionStorage.getItem(USER_CACHE) || "null"); }
    catch { return null; }
  }
  try {
    const id = localStorage.getItem(SESSION);
    if (!id) return null;
    const u = load().users.find((x) => x.id === id);
    return u ? userView(u) : null;
  } catch {
    return null;
  }
}

export async function usernameAvailable(raw) {
  if (remoteMode) {
    const { ok, reason } = await apiRequest(`/api/auth/register?username=${encodeURIComponent(raw || "")}`);
    return { ok, reason };
  }
  await wait(180);
  const problem = usernameProblem(raw);
  if (problem) return { ok: false, reason: problem };
  const taken = load().users.some((u) => (u.username || "").toLowerCase() === raw.trim().toLowerCase());
  return taken ? { ok: false, reason: "That username is taken." } : { ok: true };
}

export async function register({ username, email, password }) {
  if (remoteMode) {
    const { user } = await apiRequest("/api/auth/register", { method: "POST", body: { username, email, password } });
    cacheRemoteUser(user);
    return user;
  }
  await wait(250);
  username = (username || "").trim();
  email = (email || "").trim().toLowerCase();
  const uProblem = usernameProblem(username);
  if (uProblem) throw new ApiError(uProblem, "username");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError("Enter a valid email address.", "email");
  const pProblem = passwordProblem(password, username);
  if (pProblem) throw new ApiError(pProblem, "password");
  const db = load();
  if (db.users.some((u) => (u.username || "").toLowerCase() === username.toLowerCase())) throw new ApiError("That username is taken.", "username");
  if (db.users.some((u) => u.email === email)) throw new ApiError("An account with this email already exists. Try signing in.", "email");
  const { salt, hash } = await hashPassword(password);
  const user = { id: "u" + Date.now(), username, email, salt, hash, role: "USER", createdAt: Date.now() };
  db.users.push(user);
  save(db);
  localStorage.setItem(SESSION, user.id);
  return userView(user);
}

// Mock throttle: 5 wrong attempts per identifier, then wait 30 seconds. The real limit belongs on the server.
const attempts = {};
export async function signIn({ identifier, password }) {
  if (remoteMode) {
    const { user } = await apiRequest("/api/auth/login", { method: "POST", body: { identifier, password } });
    cacheRemoteUser(user);
    return user;
  }
  await wait(250);
  const id = (identifier || "").trim().toLowerCase();
  if (!id) throw new ApiError("Enter your username or email.", "identifier");
  if (!password) throw new ApiError("Enter your password.", "password");
  const a = attempts[id] || { n: 0, until: 0 };
  if (a.until > Date.now()) {
    throw new ApiError(`Too many tries. Wait ${Math.ceil((a.until - Date.now()) / 1000)} seconds and try again.`);
  }
  const u = load().users.find((x) => (x.username || "").toLowerCase() === id || x.email === id);
  let good = false;
  if (u && u.hash) good = (await hashPassword(password, u.salt)).hash === u.hash;
  if (!good) {
    a.n += 1;
    if (a.n >= 5) { a.until = Date.now() + 30000; a.n = 0; }
    attempts[id] = a;
    throw new ApiError("That username or password isn't right. Check them and try again.");
  }
  delete attempts[id];
  localStorage.setItem(SESSION, u.id);
  return userView(u);
}

function decodeJwt(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(part).split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""));
    return JSON.parse(json);
  } catch {
    throw new ApiError("Google sent a response we couldn't read. Try again or use a username and password.");
  }
}

// Receives the ID token ("credential") from Google Identity Services.
// DEMO ONLY: it reads the token in the browser. The real backend must verify the signature, audience,
// issuer and expiry before trusting it (POST /api/auth/google { credential }).
export async function googleSignIn(credential, username = "") {
  if (remoteMode) {
    const result = await apiRequest("/api/auth/google", { method: "POST", body: { credential, username } });
    if (result.setupRequired) return result;
    cacheRemoteUser(result.user);
    return result.user;
  }
  await wait(200);
  const p = decodeJwt(credential);
  if (GOOGLE_CLIENT_ID && p.aud !== GOOGLE_CLIENT_ID) throw new ApiError("That Google sign-in wasn't meant for this app.");
  if (!p.sub || !p.email) throw new ApiError("Google didn't share an email address, so we can't create your account.");
  if (p.exp && p.exp * 1000 < Date.now()) throw new ApiError("That Google sign-in expired. Try again.");
  if (!p.email_verified) throw new ApiError("Your Google email isn't verified yet. Verify it with Google, then try again.");
  const email = p.email.toLowerCase();
  const db = load();
  let u = db.users.find((x) => x.googleSub === p.sub) || db.users.find((x) => x.email === email);
  if (u) {
    if (!u.googleSub) u.googleSub = p.sub;
  } else {
    username = (username || "").trim();
    if (!username) return { setupRequired: true, email };
    const problem = usernameProblem(username);
    if (problem) throw new ApiError(problem, "username");
    if (db.users.some((x) => (x.username || "").toLowerCase() === username.toLowerCase())) throw new ApiError("That username is taken. Choose another.", "username");
    u = { id: "u" + Date.now(), username, email, googleSub: p.sub, role: "USER", createdAt: Date.now() };
    db.users.push(u);
  }
  save(db);
  localStorage.setItem(SESSION, u.id);
  return userView(u);
}

export function signOut() {
  if (remoteMode) {
    cacheRemoteUser(null);
    return apiRequest("/api/auth/logout", { method: "POST", body: {} });
  }
  localStorage.removeItem(SESSION);
}

export async function listIssues({ sort = "newest" } = {}) {
  if (remoteMode) return (await apiRequest(`/api/issues?sort=${encodeURIComponent(sort)}`)).issues;
  await wait();
  const uid = currentUser()?.id;
  const list = load().issues.map((i) => toPublic(i, uid));
  if (sort === "oldest") list.sort((a, b) => a.createdAt - b.createdAt);
  else if (sort === "affected") list.sort((a, b) => b.impactCount - a.impactCount || b.createdAt - a.createdAt);
  else list.sort((a, b) => b.createdAt - a.createdAt);
  return list;
}

export async function searchCommunity(rawQuery) {
  const query = String(rawQuery || "").trim();
  if (query.length < 2) return { users: [], issues: [] };
  if (remoteMode) return apiRequest(`/api/search?q=${encodeURIComponent(query)}`);
  await wait(120);
  const term = query.toLowerCase();
  const db = load();
  const users = db.users
    .filter((u) => String(u.username || "").toLowerCase().includes(term))
    .map((u) => ({ username: u.username, postCount: db.issues.filter((issue) => issue.authorId === u.id).length }))
    .sort((a, b) => a.username.localeCompare(b.username));
  const viewerId = currentUser()?.id;
  const issues = db.issues
    .filter((issue) => [issue.text, issue.category, issue.authorName].some((value) => String(value || "").toLowerCase().includes(term)))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50)
    .map((issue) => toPublic(issue, viewerId));
  return { users, issues };
}

export async function getPublicProfile(rawUsername) {
  const username = String(rawUsername || "").trim();
  if (remoteMode) return (await apiRequest(`/api/search?username=${encodeURIComponent(username)}`)).profile;
  await wait(120);
  const db = load();
  const target = db.users.find((u) => String(u.username || "").toLowerCase() === username.toLowerCase());
  if (!target) throw new ApiError("That account could not be found.");
  const viewerId = currentUser()?.id;
  const issues = db.issues
    .filter((issue) => issue.authorId === target.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((issue) => toPublic(issue, viewerId));
  const follows = Array.isArray(db.follows) ? db.follows : [];
  return {
    username: target.username,
    postCount: issues.length,
    followers: follows.filter((follow) => follow.followedId === target.id).length,
    following: follows.filter((follow) => follow.followerId === target.id).length,
    isFollowing: follows.some((follow) => follow.followerId === viewerId && follow.followedId === target.id),
    isSelf: !!viewerId && viewerId === target.id,
    issues,
  };
}

export async function setFollow(rawUsername, shouldFollow) {
  const username = String(rawUsername || "").trim();
  if (remoteMode) {
    return apiRequest("/api/search", { method: "POST", body: { username, follow: !!shouldFollow } });
  }
  await wait(120);
  const viewer = currentUser();
  if (!viewer) throw new ApiError("Sign in to follow community members.");
  const db = load();
  const target = db.users.find((entry) => String(entry.username || "").toLowerCase() === username.toLowerCase());
  if (!target) throw new ApiError("That account could not be found.");
  if (target.id === viewer.id) throw new ApiError("You can’t follow your own account.");
  const follows = Array.isArray(db.follows) ? db.follows : (db.follows = []);
  const exists = follows.some((entry) => entry.followerId === viewer.id && entry.followedId === target.id);
  if (shouldFollow && !exists) follows.push({ followerId: viewer.id, followedId: target.id, createdAt: Date.now() });
  if (!shouldFollow && exists) db.follows = follows.filter((entry) => !(entry.followerId === viewer.id && entry.followedId === target.id));
  save(db);
  return {
    isFollowing: !!shouldFollow,
    followers: db.follows.filter((entry) => entry.followedId === target.id).length,
  };
}

export async function getNotifications() {
  if (remoteMode) return (await apiRequest("/api/search?notifications=1")).notifications;
  await wait(120);
  const user = currentUser();
  if (!user) throw new ApiError("Sign in to view notifications.");
  const db = load();
  const follows = (db.follows || [])
    .filter((item) => item.followedId === user.id)
    .map((item) => {
      const actor = db.users.find((entry) => entry.id === item.followerId);
      return actor && { id: `follow-${item.followerId}-${item.followedId}`, type: "follow", actorUsername: actor.username, createdAt: item.createdAt || Date.now() };
    }).filter(Boolean);
  const comments = (db.issues || []).flatMap((issue) => issue.authorId === user.id ? (issue.comments || [])
    .filter((comment) => comment.authorId && comment.authorId !== user.id)
    .map((comment) => ({ id: comment.id, type: "comment", actorUsername: comment.authorName, createdAt: comment.createdAt, issueId: issue.id, issueText: issue.text, category: issue.category })) : []);
  return [...follows, ...comments].sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
}

export async function listMyIssues() {
  if (remoteMode) return (await apiRequest("/api/me/issues")).issues;
  await wait();
  const user = currentUser();
  if (!user) throw new ApiError("Sign in to view your profile.");
  return load().issues.filter((issue) => issue.authorId === user.id).map((issue) => toPublic(issue, user.id)).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getMyProfile() {
  if (remoteMode) return apiRequest("/api/me/issues");
  return { issues: await listMyIssues(), followers: 0, following: 0 };
}

export async function deleteMyIssue(issueId) {
  if (remoteMode) return apiRequest(`/api/issues/${encodeURIComponent(issueId)}`, { method: "DELETE", body: {} });
  await wait(120);
  const user = currentUser();
  if (!user) throw new ApiError("Sign in to manage your posts.");
  const db = load();
  const index = db.issues.findIndex((issue) => issue.id === issueId && issue.authorId === user.id);
  if (index < 0) throw new ApiError("That post isn't available on your profile.");
  db.issues.splice(index, 1);
  save(db);
  return { ok: true };
}

export async function getIssue(id) {
  if (remoteMode) return (await apiRequest(`/api/issues/${encodeURIComponent(id)}`)).issue;
  await wait();
  const i = load().issues.find((x) => x.id === id);
  if (!i) throw new ApiError("We couldn't find that issue. It may have been removed.");
  return toPublic(i, currentUser()?.id);
}

export async function createIssue({ text, category, location, photo }) {
  if (remoteMode) return (await apiRequest("/api/issues", { method: "POST", body: { text, category, location, photo } })).issue;
  await wait(250);
  const user = currentUser();
  if (!user) throw new ApiError("Sign in to post an issue.");
  text = (text || "").trim();
  if (text.length < LIMITS.issueMin) throw new ApiError(`Describe the issue in at least ${LIMITS.issueMin} characters.`);
  if (text.length > LIMITS.issueMax) throw new ApiError(`Keep the description under ${LIMITS.issueMax} characters.`);
  if (!CATEGORIES.includes(category)) throw new ApiError("Choose a category.");
  if (!location) throw new ApiError("Choose where the issue is on the map.");
  const db = load();
  const issue = {
    id: "i" + Date.now(),
    authorId: user.id,
    authorName: user.name,
    category,
    text,
    location,
    photo: photo || null,
    createdAt: Date.now(),
    impact: [],
    comments: [],
  };
  db.issues.push(issue);
  save(db);
  return toPublic(issue, user.id);
}

export async function addComment(issueId, text) {
  if (remoteMode) return (await apiRequest(`/api/issues/${encodeURIComponent(issueId)}/comments`, { method: "POST", body: { text } })).comment;
  await wait();
  const user = currentUser();
  if (!user) throw new ApiError("Sign in to join the discussion.");
  text = (text || "").trim();
  if (!text) throw new ApiError("Write something before you post.");
  if (text.length > LIMITS.commentMax) throw new ApiError(`Keep comments under ${LIMITS.commentMax} characters.`);
  const db = load();
  const issue = db.issues.find((i) => i.id === issueId);
  if (!issue) throw new ApiError("This issue is no longer available.");
  const c = { id: issueId + "-c" + Date.now(), authorId: user.id, authorName: user.name, text, createdAt: Date.now() };
  issue.comments.push(c);
  save(db);
  return c;
}

// One response per user per issue. Toggling off removes it (a product decision still to confirm).
export async function setImpact(issueId, affected) {
  if (remoteMode) return apiRequest(`/api/issues/${encodeURIComponent(issueId)}/impact`, { method: "POST", body: { affected } });
  await wait(90);
  const user = currentUser();
  if (!user) throw new ApiError("Sign in to say this affects you.");
  const db = load();
  const issue = db.issues.find((i) => i.id === issueId);
  if (!issue) throw new ApiError("This issue is no longer available.");
  const has = issue.impact.includes(user.id);
  if (affected && !has) issue.impact.push(user.id);
  if (!affected && has) issue.impact = issue.impact.filter((x) => x !== user.id);
  save(db);
  return { impactCount: issue.impact.length, youAffected: issue.impact.includes(user.id) };
}

// Stored with the reporter's id for moderators only; it is never returned to other users.
export async function reportContent({ type, id, reason }) {
  if (remoteMode) return apiRequest("/api/reports", { method: "POST", body: { type, id, reason } });
  await wait();
  const user = currentUser();
  if (!user) throw new ApiError("Sign in to report content.");
  if (!REPORT_REASONS.includes(reason)) throw new ApiError("Choose a reason.");
  const db = load();
  if (db.reports.some((r) => r.type === type && r.id === id && r.reporterId === user.id)) return { ok: true, repeat: true };
  db.reports.push({ type, id, reason, reporterId: user.id, createdAt: Date.now(), status: "OPEN" });
  save(db);
  return { ok: true };
}
