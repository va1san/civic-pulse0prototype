// Shared building blocks: header, footer, toast, issue card, form field, report dialog, data hooks.
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "./app-context.jsx";
import * as api from "./database.js";

export function timeAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const userProfileHref = (username) => `#/user/${encodeURIComponent(username)}`;

const TONES = ["#DB2C70", "#E0612B", "#5B3FA0", "#2F6FB0", "#B4337A", "#C2410C"];
export function Avatar({ name, size = 32 }) {
  const tone = TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
  return (
    <span className="avatar" style={{ width: size, height: size, background: tone, fontSize: size * 0.4 }} aria-hidden="true">
      {name.trim()[0]?.toUpperCase()}
    </span>
  );
}

export function Logo({ href = "#/" }) {
  return (
    <a className="logo" href={href} aria-label="Civic Pulse home">
      <svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
        <g transform="translate(7 0)">
          <path d="M37.51 17.91A17 17 0 1 0 37.51 46.09" fill="none" stroke="#DB2C70" strokeWidth="10.5" strokeLinecap="round" />
          <circle cx="28" cy="32" r="5.2" fill="#FF7A3D" />
          <path d="M50.65 15.54A28 28 0 1 0 50.65 48.46" fill="none" stroke="#FF7A3D" strokeWidth="3.6" strokeLinecap="round" opacity=".75" />
        </g>
      </svg>
      <span>Civic Pulse</span>
    </a>
  );
}

export function DesktopHomeLogo() {
  const { user, route } = useApp();
  const here = route.parts[0] || "";
  if (!user || !here || here === "signin" || here === "register") return null;
  return <div className="desktop-home-logo"><Logo href="#/feed" /></div>;
}

export function Header() {
  const { user, signOut, route } = useApp();
  const [open, setOpen] = useState(false);
  const here = route.parts[0] || "";
  const onAuth = here === "signin" || here === "register";
  const onLanding = !here;
  // Signed-in community pages use the persistent bottom navigation as their
  // single app navigation surface. Keep the header on landing/auth pages.
  if (user && !onLanding && !onAuth) return null;
  const link = (to, text, key) => (
    <a href={`#/${to}`} aria-current={here === key ? "page" : undefined} onClick={() => setOpen(false)}>
      {text}
    </a>
  );
  return (
    <header className={"site-header" + (onLanding ? " on-landing" : "")}>
      <div className="wrap bar">
        <Logo />
        {(user || !onAuth) && (
          <button className="menu-btn" aria-expanded={open} aria-controls="nav" onClick={() => setOpen(!open)}>
            {open ? "Close" : "Menu"}
          </button>
        )}
        <nav id="nav" className={"nav" + (open ? " open" : "")} aria-label="Main">
          {user ? (
            <>
              {link("feed", "Issues", "feed")}
              {link("search", "Search", "search")}
              {link("profile", "Profile", "profile")}
              {link("map", "Map", "map")}
              <a className="btn btn-primary" href="#/new" onClick={() => setOpen(false)}>Report an issue</a>
              <button className="btn btn-quiet" onClick={() => { setOpen(false); signOut(); }}>
                Sign out <span className="who">({user.name.split(" ")[0]})</span>
              </button>
            </>
          ) : !onAuth && (
            <>
              <a className="btn btn-quiet" href="#/signin" onClick={() => setOpen(false)}>Sign in</a>
              <a className="btn btn-primary" href="#/register" onClick={() => setOpen(false)}>Create account</a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function BottomNav() {
  const { user, route } = useApp();
  const here = route.parts[0] || "";
  if (!user || here === "signin" || here === "register") return null;
  const active = here === "new" ? "new" : here === "issue" ? "feed" : here;
  const items = [
    ["feed", "Home", "⌂"],
    ["search", "Search", "⌕"],
    ["notifications", "Alerts", "♧"],
    ["new", "Create", "+"],
    ["map", "Map", "⌖"],
    ["profile", "Profile", "◉"],
  ];
  return (
    <nav className="mobile-bottom-nav" aria-label="Community navigation">
      {items.map(([to, label, icon]) => (
        <a key={to} href={`#/${to}`} className={(active === to ? "active " : "") + (to === "new" ? "create" : "")} aria-current={active === to ? "page" : undefined}>
          <span aria-hidden="true">{icon}</span>{label}
        </a>
      ))}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap foot">
        <p>Civic Pulse is a resident-run space for local issues. It is not connected to any government body, and reports are not sent to or resolved by one.</p>
        <p className="foot-small">Demo build: accounts and posts are saved in this browser only.</p>
      </div>
    </footer>
  );
}

export function Toast() {
  const { toast } = useApp();
  return (
    <div className="toast-zone" role="status" aria-live="polite">
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export function IssueCard({ issue }) {
  return (
    <article className="issue">
      <a className="issue-card-overlay" href={`#/issue/${issue.id}`} aria-label={`Open issue: ${issue.text}`} />
      <div className="issue-main">
        <span className="chip">{issue.category}</span>
        <p className="issue-text">{issue.text}</p>
        <p className="issue-meta">
          <a className="issue-author-link" href={userProfileHref(issue.authorName)}><Avatar name={issue.authorName} size={22} /><span>{issue.authorName}</span></a>
          <span aria-hidden="true">·</span>
          <span>{timeAgo(issue.createdAt)}</span>
        </p>
        <p className="issue-stats">
          <span>{issue.impactCount} affected</span>
          <span>{issue.commentCount} {issue.commentCount === 1 ? "comment" : "comments"}</span>
        </p>
      </div>
      {issue.photo && <img className="issue-photo" src={issue.photo} alt="" loading="lazy" />}
    </article>
  );
}

export function IssueSkeletons({ n = 3 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <div key={i} className="issue skeleton" />)}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function Field({ id, label, hint, error, children }) {
  return (
    <div className={"field" + (error ? " has-error" : "")}>
      <label htmlFor={id}>{label}</label>
      {hint && <p className="hint" id={id + "-hint"}>{hint}</p>}
      {children}
      {error && <p className="err" id={id + "-err"} role="alert">{error}</p>}
    </div>
  );
}

// Report an issue or comment. The reporter stays hidden from other users.
export function ReportButton({ type, id }) {
  const { user, notify } = useApp();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api.reportContent({ type, id, reason });
      setOpen(false);
      setReason("");
      notify("Report sent to the moderators. Other people can't see that you reported it.");
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return <a className="link-quiet" href="#/signin">Sign in to report</a>;
  return (
    <>
      <button type="button" className="link-quiet" onClick={() => setOpen(true)}>Report</button>
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <form className="dialog" role="dialog" aria-modal="true" aria-labelledby={`rp-${id}`} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h3 id={`rp-${id}`}>Report this {type}</h3>
            <p className="hint">Moderators will take a look. The person who posted it won't be told who reported it.</p>
            <fieldset>
              <legend className="sr">Reason</legend>
              {api.REPORT_REASONS.map((r) => (
                <label key={r} className="radio">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                  <span>{r}</span>
                </label>
              ))}
            </fieldset>
            {err && <p className="err" role="alert">{err}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!reason || busy}>{busy ? "Sending…" : "Send report"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export function useIssues(sort) {
  const [issues, setIssues] = useState(null);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const requestId = useRef(0);
  const load = useCallback(() => {
    const id = ++requestId.current;
    setError("");
    return api.listIssues({ sort }).then((nextIssues) => {
      if (id !== requestId.current) return;
      setIssues(nextIssues);
      setUpdatedAt(Date.now());
    }).catch((e) => {
      if (id === requestId.current) setError(e.message);
    });
  }, [sort]);
  useEffect(() => {
    let active = true;
    let lastRefresh = 0;
    const refresh = (force = false) => {
      if (!active || document.visibilityState === "hidden") return;
      const now = Date.now();
      if (!force && now - lastRefresh < 1500) return;
      lastRefresh = now;
      load();
    };
    refresh(true);
    const interval = window.setInterval(() => refresh(), 20000);
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", onVisibility);
    window.addEventListener("online", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      requestId.current += 1;
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisibility);
      window.removeEventListener("online", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);
  return { issues, error, reload: load, updatedAt };
}

export function LoadError({ message, retry }) {
  return (
    <div className="banner-err" role="alert">
      {message} <button className="link-quiet" onClick={retry}>Try again</button>
    </div>
  );
}
