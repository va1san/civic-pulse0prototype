// SECONDARY DISPLAY PAGES: everything after the landing page except the map.
// Issues feed (#/feed), post an issue (#/new), issue detail + discussion (#/issue/:id), sign in / register.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "./database.js";
import MapView from "./mapbox-map.jsx";
import { Avatar, Empty, Field, IssueCard, IssueSkeletons, LoadError, ReportButton, timeAgo, useIssues, userProfileHref } from "./shared-components.jsx";
import { navigate, useApp } from "./app-context.jsx";

export function Feed() {
  const { issues, error, reload, updatedAt } = useIssues("newest");
  const { user } = useApp();
  return (
    <main className="wrap page timeline-page">
      <aside className="timeline-nav" aria-label="Community navigation">
        <a className="timeline-nav-item active" href="#/feed"><span aria-hidden="true">⌂</span> Home feed</a>
        <a className="timeline-nav-item" href="#/map"><span aria-hidden="true">⌖</span> Explore map</a>
        <a className="btn btn-primary timeline-nav-post" href="#/new">＋ &nbsp;Report an issue</a>
      </aside>
      <section className="timeline-main" aria-labelledby="feed-title">
        <div className="timeline-title">
          <div><p className="eyebrow">YOUR COMMUNITY</p><h1 id="feed-title" className="h1-sm">Home</h1><p className="feed-live-status" aria-live="polite">{updatedAt ? `Live · updated ${timeAgo(updatedAt).toLowerCase()}` : "Checking for new posts…"}</p></div>
        </div>
        <a className="timeline-composer" href={user ? "#/new" : "#/signin?next=/new"}>
          {user ? <Avatar name={user.name} size={42} /> : <span className="composer-avatar" aria-hidden="true">＋</span>}
          <span className="composer-prompt">What's happening in your neighbourhood?</span>
          <span className="composer-action">Post</span>
        </a>
        {error && <LoadError message={error} retry={reload} />}
        {!issues && !error && <IssueSkeletons n={4} />}
        {issues && issues.length === 0 && (
          <div className="timeline-empty"><div className="empty-mark" aria-hidden="true">✳</div><h2>It’s quiet around here.</h2>
            <p>No one has posted yet. Start the conversation with the first local issue.</p>
            <a className="btn btn-primary" href={user ? "#/new" : "#/signin?next=/new"}>Create the first post</a>
          </div>
        )}
        {issues && issues.length > 0 && <div className="issue-list timeline-list">{issues.map((i) => <IssueCard key={i.id} issue={i} />)}</div>}
      </section>
      <aside className="timeline-about">
        <h2>Neighbourhood pulse</h2><p>Local reports, conversations, and updates from people nearby.</p>
        <a href="#/map" className="link-arrow">See reports on the map</a>
      </aside>
    </main>
  );
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      const next = await api.getNotifications();
      setNotifications(next);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    reload();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [reload]);

  return (
    <main className="wrap page narrow notifications-page">
      <section className="panel" aria-labelledby="notifications-title">
        <div className="panel-head"><p className="eyebrow">YOUR COMMUNITY</p><h1 id="notifications-title" className="h1-sm">Notifications</h1><p className="muted">Follows and new comments on your posts.</p></div>
        {error && <LoadError message={error} retry={reload} />}
        {!notifications && !error && <IssueSkeletons n={3} />}
        {notifications?.length === 0 && <div className="notifications-empty"><div className="empty-mark" aria-hidden="true">✳</div><h2>You’re all caught up.</h2><p>No new activity yet. We’ll show it here when someone follows you or comments on your post.</p></div>}
        {!!notifications?.length && <ul className="notification-list">{notifications.map((item) => (
          <li key={item.id}>
            <span className={`notification-mark ${item.type}`} aria-hidden="true">{item.type === "follow" ? "＋" : "↩"}</span>
            <div className="notification-copy">
              <p><a href={userProfileHref(item.actorUsername)}>{item.actorUsername}</a> {item.type === "follow" ? "started following you" : "commented on your post"}</p>
              {item.type === "comment" && <a className="notification-post" href={`#/issue/${encodeURIComponent(item.issueId)}`}>{item.issueText}</a>}
              <span className="muted small">{timeAgo(item.createdAt)}</span>
            </div>
          </li>
        ))}</ul>}
      </section>
    </main>
  );
}

export function SearchPage() {
  const { route } = useApp();
  const [query, setQuery] = useState(route.query.get("q") || "");
  useEffect(() => setQuery(route.query.get("q") || ""), [route.query]);
  const [results, setResults] = useState({ users: [], issues: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { setResults({ users: [], issues: [] }); setError(""); setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => api.searchCommunity(value).then((data) => {
      if (active) { setResults(data); setLoading(false); }
    }).catch((e) => {
      if (active) { setError(e.message); setLoading(false); }
    }), 220);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  const search = (e) => {
    e.preventDefault();
    const value = new FormData(e.currentTarget).get("q") || "";
    window.location.hash = `/search?q=${encodeURIComponent(value)}`;
  };
  return (
    <main className="wrap page timeline-page">
      <aside className="timeline-nav" aria-label="Community navigation">
        <a className="timeline-nav-item" href="#/feed"><span aria-hidden="true">⌂</span> Home feed</a>
        <a className="timeline-nav-item" href="#/map"><span aria-hidden="true">⌖</span> Explore map</a>
        <a className="btn btn-primary timeline-nav-post" href="#/new">＋ &nbsp;Report an issue</a>
      </aside>
      <section className="timeline-main" aria-labelledby="search-title">
        <div className="timeline-title"><div><p className="eyebrow">YOUR COMMUNITY</p><h1 id="search-title" className="h1-sm">Search</h1></div></div>
        <form className="community-search" role="search" onSubmit={search}>
          <label className="sr" htmlFor="community-search">Search issues</label>
          <input id="community-search" name="q" type="search" placeholder="Search posts, categories, or people" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn btn-primary" type="submit">Search</button>
        </form>
        {query.trim().length < 2 && <div className="search-prompt">Enter at least 2 characters to find accounts and posts.</div>}
        {loading && <IssueSkeletons n={2} />}
        {error && <LoadError message={error} retry={() => setQuery((value) => value + " ")} />}
        {!loading && !error && query.trim().length >= 2 && results.users.length === 0 && results.issues.length === 0 && <div className="timeline-empty"><div className="empty-mark" aria-hidden="true">⌕</div><h2>No results</h2><p>Try a different username, post, or category.</p></div>}
        {!loading && results.users.length > 0 && <section className="search-results" aria-labelledby="accounts-heading"><h2 id="accounts-heading">Accounts</h2>{results.users.map((account) => <a className="search-user" key={account.username} href={`#/user/${encodeURIComponent(account.username)}`}><Avatar name={account.username} size={42} /><span className="search-user-name"><b>@{account.username}</b><small>{account.postCount} {account.postCount === 1 ? "post" : "posts"}</small></span><span className="search-user-open" aria-hidden="true">›</span></a>)}</section>}
        {!loading && results.issues.length > 0 && <section className="search-results" aria-labelledby="posts-heading"><h2 id="posts-heading">Posts</h2><div className="issue-list timeline-list">{results.issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}</div></section>}
      </section>
      <aside className="timeline-about"><h2>Find neighbours and reports</h2><p>Search usernames, post text, and categories across the community.</p><a href="#/map" className="link-arrow">Explore the map</a></aside>
    </main>
  );
}

export function UserProfilePage({ username }) {
  const { user, notify } = useApp();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setProfile(null);
    setError("");
    api.getPublicProfile(username).then((data) => active && setProfile(data)).catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, [username]);
  const toggleFollow = async () => {
    if (!profile || followBusy) return;
    setFollowBusy(true);
    setError("");
    try {
      const result = await api.setFollow(profile.username, !profile.isFollowing);
      setProfile((current) => current ? { ...current, ...result } : current);
      notify(result.isFollowing ? `Following @${profile.username}.` : `Unfollowed @${profile.username}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setFollowBusy(false);
    }
  };
  const isOwnProfile = profile?.isSelf === true || (user && String(user.username || user.name).toLowerCase() === String(profile?.username || username).toLowerCase());
  return (
    <main className="wrap page timeline-page profile-page">
      <aside className="timeline-nav" aria-label="Community navigation">
        <a className="timeline-nav-item" href="#/feed"><span aria-hidden="true">⌂</span> Home feed</a>
        <a className="timeline-nav-item" href="#/map"><span aria-hidden="true">⌖</span> Explore map</a>
        <a className="timeline-nav-item" href="#/search"><span aria-hidden="true">⌕</span> Search</a>
        <a className="btn btn-primary timeline-nav-post" href="#/new">＋ &nbsp;Report an issue</a>
      </aside>
      <section className="timeline-main" aria-labelledby="public-profile-title">
        {error && <div className="banner-err" role="alert">{error} <a href="#/search">Back to search</a></div>}
        {!profile && !error && <IssueSkeletons n={2} />}
        {profile && <>
          <div className="profile-hero public-profile-hero"><Avatar name={profile.username} size={76} /><div className="profile-identity"><p className="eyebrow">COMMUNITY MEMBER</p><h1 id="public-profile-title" className="h1-sm">{profile.username}</h1><p className="muted">@{profile.username}</p></div>{!isOwnProfile && (user ? <button className={`btn follow-toggle ${profile.isFollowing ? "btn-outline" : "btn-primary"}`} disabled={followBusy} onClick={toggleFollow}>{followBusy ? "Updating…" : profile.isFollowing ? "Following" : "Follow"}</button> : <a className="btn btn-primary follow-toggle" href={`#/signin?next=${encodeURIComponent(`/user/${profile.username}`)}`}>Sign in to follow</a>)}</div>
          <div className="profile-stats" aria-label="Profile statistics"><div><b>{profile.postCount}</b><span>Posts</span></div><div><b>{profile.followers}</b><span>Followers</span></div><div><b>{profile.following}</b><span>Following</span></div></div>
          <div className="profile-post-heading"><h2>Posts</h2></div>
          {profile.issues.length === 0 && <div className="timeline-empty"><h2>No posts yet</h2><p>This neighbour hasn't shared a local issue yet.</p></div>}
          {profile.issues.length > 0 && <div className="profile-post-list">{profile.issues.map((issue) => <div className="profile-post" key={issue.id}><IssueCard issue={issue} /></div>)}</div>}
        </>}
      </section>
      <aside className="timeline-about"><h2>Neighbourhood pulse</h2><p>Local reports and conversations from people nearby.</p><a href="#/search" className="link-arrow">Find more neighbours</a></aside>
    </main>
  );
}

export function Profile() {
  const { user, notify, signOut } = useApp();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const load = () => { setError(""); api.getMyProfile().then(setProfile).catch((e) => setError(e.message)); };
  useEffect(() => { if (!user) { navigate("/signin?next=/profile"); return; } load(); }, [user]);
  const remove = async (issue) => {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    setDeleting(issue.id);
    try { await api.deleteMyIssue(issue.id); setProfile((current) => ({ ...current, issues: current.issues.filter((item) => item.id !== issue.id) })); notify("Post deleted."); }
    catch (e) { setError(e.message); }
    finally { setDeleting(null); }
  };
  if (!user) return null;
  const name = user.username || user.name;
  return (
    <main className="wrap page timeline-page profile-page">
      <aside className="timeline-nav" aria-label="Community navigation">
        <a className="timeline-nav-item" href="#/feed"><span aria-hidden="true">⌂</span> Home feed</a>
        <a className="timeline-nav-item" href="#/map"><span aria-hidden="true">⌖</span> Explore map</a>
        <a className="timeline-nav-item active" href="#/profile"><span aria-hidden="true">◉</span> Profile</a>
        <a className="btn btn-primary timeline-nav-post" href="#/new">＋ &nbsp;Report an issue</a>
      </aside>
      <section className="timeline-main" aria-labelledby="profile-title">
        <div className="profile-hero">
          <Avatar name={name} size={76} />
          <div className="profile-identity"><p className="eyebrow">YOUR ACCOUNT</p><h1 id="profile-title" className="h1-sm">{name}</h1><p className="muted">@{name}</p></div>
          <div className="profile-actions"><a className="btn btn-outline profile-edit" href="#/profile">Your profile</a><button className="btn btn-quiet" onClick={signOut}>Sign out</button></div>
        </div>
        <div className="profile-stats" aria-label="Profile statistics">
          <div><b>{profile?.issues.length ?? "—"}</b><span>Posts</span></div>
          <div><b>{profile?.followers ?? "—"}</b><span>Followers</span></div>
          <div><b>{profile?.following ?? "—"}</b><span>Following</span></div>
        </div>
        <div className="profile-post-heading"><h2>Your posts</h2><span className="muted small">Only you can see delete options</span></div>
        {error && <div className="banner-err" role="alert">{error} <button className="link-quiet" onClick={load}>Try again</button></div>}
        {!profile && !error && <IssueSkeletons n={2} />}
        {profile?.issues.length === 0 && <div className="timeline-empty"><div className="empty-mark" aria-hidden="true">✳</div><h2>No posts yet</h2><p>Your local reports will show up here.</p><a className="btn btn-primary" href="#/new">Create your first post</a></div>}
        {profile?.issues.length > 0 && <div className="profile-post-list">{profile.issues.map((issue) => <div className="profile-post" key={issue.id}><IssueCard issue={issue} /><button className="profile-delete" disabled={deleting === issue.id} onClick={() => remove(issue)} aria-label={`Delete post: ${issue.text}`}>{deleting === issue.id ? "Deleting…" : "Delete post"}</button></div>)}</div>}
      </section>
      <aside className="timeline-about"><h2>Your activity</h2><p>All reports you’ve shared with your neighbourhood, together in one place.</p><a href="#/new" className="link-arrow">Post a local issue</a></aside>
    </main>
  );
}

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("We couldn't read that image. Try a different photo."));
    img.src = url;
  });
}

export function NewIssue() {
  const { user, notify } = useApp();
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [photo, setPhoto] = useState(null);
  const [loc, setLoc] = useState(null);
  const [errors, setErrors] = useState({});
  const [locMsg, setLocMsg] = useState("");
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectLocation = (point) => {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) {
      setLoc(null);
      setLocMsg("Choose a valid spot on the map.");
      return;
    }
    setLoc(point);
    setLocMsg("");
  };

  useEffect(() => {
    if (!user) navigate("/signin?next=/new");
  }, [user]);
  if (!user) return null;

  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return setErrors({ ...errors, photo: "Use a JPG, PNG or WebP photo." });
    if (f.size > api.LIMITS.photoMB * 1024 * 1024) return setErrors({ ...errors, photo: `That photo is over ${api.LIMITS.photoMB} MB. Choose a smaller one.` });
    try {
      setPhoto(await shrinkImage(f));
      setErrors({ ...errors, photo: "" });
    } catch (x) {
      setErrors({ ...errors, photo: x.message });
    }
  };

  const useMyLocation = () => {
    setLocMsg("");
    if (!window.isSecureContext) return setLocMsg("Current location needs a secure connection. Open Civic Pulse using its https address.");
    if (!navigator.geolocation) return setLocMsg("This browser can’t share your location. Tap the map to choose a spot.");
    setLocating(true);
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setLocating(false);
          const { latitude: lat, longitude: lng } = p.coords;
          selectLocation({ lat, lng });
        },
        (error) => {
          setLocating(false);
          const message = error.code === 1
            ? "Location access is blocked. Allow it in your browser’s site settings, then try again."
            : error.code === 3
              ? "Finding your location took too long. Try again or tap the map."
              : "Your location couldn’t be found. Check your device location services or tap the map.";
          setLocMsg(message);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
      );
    } catch {
      setLocating(false);
      setLocMsg("Your browser couldn’t start location sharing. Check its site settings or tap the map.");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    const t = text.trim();
    if (t.length < api.LIMITS.issueMin) errs.text = `Describe the issue in at least ${api.LIMITS.issueMin} characters.`;
    if (!category) errs.category = "Choose a category.";
    if (!loc) errs.loc = "Choose where the issue is on the map.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const issue = await api.createIssue({ text: t, category, location: loc, photo });
      notify("Issue posted. It's now in the feed.");
      navigate(`/issue/${issue.id}`);
    } catch (x) {
      setErrors({ form: x.message });
      setBusy(false);
    }
  };

  return (
    <main className="wrap page narrow">
      <h1 className="h1-sm">Report an issue</h1>
      <p className="muted">Stick to what you can see. Other residents can add detail in the discussion.</p>
      <form className="form" onSubmit={submit} noValidate>
        {errors.form && <p className="banner-err" role="alert">{errors.form}</p>}

        <Field id="text" label="What's the issue?" error={errors.text}>
          <textarea id="text" rows="4" maxLength={api.LIMITS.issueMax} value={text} onChange={(e) => setText(e.target.value)} aria-describedby={errors.text ? "text-err" : undefined} />
          <p className="count">{text.length} / {api.LIMITS.issueMax}</p>
        </Field>

        <Field id="category" label="Category" error={errors.category}>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Choose one</option>
            {api.CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>

        <Field id="photo" label="Photo (optional)" hint={`One photo, JPG, PNG or WebP, up to ${api.LIMITS.photoMB} MB.`} error={errors.photo}>
          {photo ? (
            <div className="photo-prev">
              <img src={photo} alt="Your photo preview" />
              <button type="button" className="btn btn-quiet" onClick={() => setPhoto(null)}>Remove photo</button>
            </div>
          ) : (
            <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} aria-describedby="photo-hint" />
          )}
        </Field>

        <Field id="loc" label="Where is it?" hint="Tap anywhere on the map to choose a location, or use your current location. Public pins are shown approximately." error={errors.loc}>
          <div className="map-frame pick">
            <MapView issues={[]} pick={loc} onPick={selectLocation} label="Choose the issue location" />
          </div>
          <div className="loc-row">
            <button type="button" className="btn btn-outline" onClick={useMyLocation} disabled={locating}>{locating ? "Finding location…" : "Use my location"}</button>
            <span className="muted small" aria-live="polite">{locating ? "Checking your device location…" : loc ? "Location chosen." : "No location chosen yet."}</span>
          </div>
          {locMsg && <p className="hint" role="status">{locMsg}</p>}
        </Field>

        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Posting…" : "Post issue"}</button>
      </form>
    </main>
  );
}

export function IssueDetail({ id }) {
  const { user, notify } = useApp();
  const [issue, setIssue] = useState(null);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [cErr, setCErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [iBusy, setIBusy] = useState(false);

  useEffect(() => {
    setIssue(null);
    setError("");
    api.getIssue(id).then(setIssue).catch((e) => setError(e.message));
  }, [id]);

  const oneIssue = useMemo(() => (issue ? [issue] : []), [issue]);

  if (error) {
    return (
      <main className="wrap page narrow">
        <Empty title="Issue not found">{error} <a href="#/feed">Back to issues</a></Empty>
      </main>
    );
  }
  if (!issue) return <main className="wrap page narrow"><IssueSkeletons n={1} /></main>;

  const toggleImpact = async () => {
    setIBusy(true);
    try {
      const r = await api.setImpact(issue.id, !issue.youAffected);
      setIssue({ ...issue, ...r });
    } catch (x) {
      notify(x.message);
    } finally {
      setIBusy(false);
    }
  };

  const postComment = async (e) => {
    e.preventDefault();
    setBusy(true);
    setCErr("");
    try {
      const c = await api.addComment(issue.id, comment);
      setIssue({ ...issue, comments: [...issue.comments, c], commentCount: issue.commentCount + 1 });
      setComment("");
    } catch (x) {
      setCErr(x.message + " Your comment is still here, so you can try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="wrap page detail">
      <a className="back" href="#/feed">← All issues</a>
      <div className="detail-grid">
        <article>
          <span className="chip">{issue.category}</span>
          <h1 className="detail-text">{issue.text}</h1>
          <p className="issue-meta">
            <a className="issue-author-link" href={userProfileHref(issue.authorName)}><Avatar name={issue.authorName} size={26} /><span>{issue.authorName}</span></a>
            <span aria-hidden="true">·</span>
            <span>{timeAgo(issue.createdAt)}</span>
            <span aria-hidden="true">·</span>
            <ReportButton type="issue" id={issue.id} />
          </p>
          {issue.photo && <img className="detail-photo" src={issue.photo} alt={`Photo added by ${issue.authorName}`} />}

          <section className="discuss" aria-labelledby="disc-h">
            <h2 id="disc-h">Discussion ({issue.commentCount})</h2>
            {issue.comments.length === 0 && <p className="muted">No comments yet. Add what you've seen.</p>}
            <ul className="comments">
              {issue.comments.map((c) => (
                <li key={c.id}>
                  <a className="comment-avatar-link" href={userProfileHref(c.authorName)} aria-label={`View ${c.authorName}’s profile`}><Avatar name={c.authorName} size={34} /></a>
                  <div>
                    <p className="c-head"><a className="comment-author-link" href={userProfileHref(c.authorName)}>{c.authorName}</a> <span className="muted">{timeAgo(c.createdAt)}</span> <ReportButton type="comment" id={c.id} /></p>
                    <p className="c-body">{c.text}</p>
                  </div>
                </li>
              ))}
            </ul>

            {user ? (
              <form className="comment-form" onSubmit={postComment}>
                <label htmlFor="comment" className="sr">Add a comment</label>
                <textarea id="comment" rows="3" placeholder="Add what you've seen or know" maxLength={api.LIMITS.commentMax} value={comment} onChange={(e) => setComment(e.target.value)} />
                {cErr && <p className="err" role="alert">{cErr}</p>}
                <button className="btn btn-primary" disabled={busy || !comment.trim()}>{busy ? "Posting…" : "Post comment"}</button>
              </form>
            ) : (
              <p className="signin-prompt"><a href={`#/signin?next=/issue/${issue.id}`}>Sign in</a> to join the discussion.</p>
            )}
          </section>
        </article>

        <aside className="detail-side">
          <div className="impact">
            <h2>Does this affect you?</h2>
            <p className="impact-count"><b>{issue.impactCount}</b> {issue.impactCount === 1 ? "person says" : "people say"} it affects them</p>
            {user ? (
              <button className={"btn " + (issue.youAffected ? "btn-signal" : "btn-outline")} aria-pressed={issue.youAffected} onClick={toggleImpact} disabled={iBusy}>
                {issue.youAffected ? "You said this affects you" : "This affects me"}
              </button>
            ) : (
              <a className="btn btn-outline" href={`#/signin?next=/issue/${issue.id}`}>Sign in to respond</a>
            )}
            <p className="small muted">This is an impact signal, not verification that the report is accurate.</p>
          </div>
          <div className="map-frame small">
            <MapView issues={oneIssue} selectedId={issue.id} label="Approximate location of this issue" />
          </div>
          <p className="small muted">Approximate location, shown to protect privacy.</p>
        </aside>
      </div>
    </main>
  );
}

/* ---------- Sign in / register ---------- */
export function PasswordInput({ id, value, onChange, autoComplete, describedBy, invalid, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input id={id} type={show ? "text" : "password"} placeholder={placeholder} autoComplete={autoComplete} value={value} onChange={onChange} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
      <button type="button" className="pw-toggle" aria-pressed={show} onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
    </div>
  );
}

function Strength({ password }) {
  if (!password) return null;
  const { score, label } = api.passwordStrength(password);
  return (
    <div className="strength" aria-live="polite">
      <span className="bars" aria-hidden="true">{[1, 2, 3].map((n) => <i key={n} className={score >= n ? "on s" + score : ""} />)}</span>
      <span>{label}</span>
    </div>
  );
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const el = document.createElement("script");
    el.src = "https://accounts.google.com/gsi/client";
    el.async = true;
    el.onload = resolve;
    el.onerror = reject;
    document.head.appendChild(el);
  });
}

const GoogleG = () => (
  <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16.9z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.1-5.5c-2 1.4-4.9 2.3-8.8 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

export function GoogleButton({ mode, onCredential }) {
  const clientId = window.__CONFIG__?.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const holder = useRef(null);
  const handler = useRef(onCredential);
  handler.current = onCredential;
  const [state, setState] = useState(clientId ? "loading" : "unset");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!clientId) return;
    let alive = true;
    loadGoogleScript()
      .then(() => {
        if (!alive || !holder.current) return;
        window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => handler.current(r.credential) });
        window.google.accounts.id.renderButton(holder.current, {
          theme: "outline", size: "large", shape: "pill", logo_alignment: "center",
          text: mode === "register" ? "signup_with" : "continue_with",
          width: Math.min(holder.current.offsetWidth || 360, 400),
        });
        setState("ready");
      })
      .catch(() => alive && setState("failed"));
    return () => { alive = false; };
  }, [clientId, mode]);

  if (state === "unset") {
    return (
      <div>
        <button type="button" className="btn btn-outline btn-wide g-btn" onClick={() => setNote("Google sign-in isn't set up yet. Paste your Google client ID into config.js (GOOGLE_CLIENT_ID) and refresh. See README.")}>
          <GoogleG /> Continue with Google
        </button>
        {note && <p className="hint" role="status">{note}</p>}
      </div>
    );
  }
  return (
    <div>
      <div ref={holder} className="g-slot" />
      {state === "loading" && <p className="hint">Loading Google sign-in…</p>}
      {state === "failed" && <p className="hint" role="status">Couldn't load Google sign-in. Check your connection, or use a username and password.</p>}
    </div>
  );
}

export function GoogleUsernameSetup({ credential, email, onComplete, onCancel }) {
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const validation = username.trim() ? api.usernameProblem(username) : "";
  const message = validation || (availability && !availability.ok ? availability.reason : error);

  useEffect(() => {
    const value = username.trim();
    if (!value || api.usernameProblem(value)) { setAvailability(null); return; }
    let active = true;
    const timer = setTimeout(() => api.usernameAvailable(value).then((result) => active && setAvailability(result)).catch(() => active && setAvailability(null)), 300);
    return () => { active = false; clearTimeout(timer); };
  }, [username]);

  const submit = async (event) => {
    event.preventDefault();
    if (validation || !availability?.ok) return;
    setBusy(true);
    setError("");
    try {
      const user = await api.googleSignIn(credential, username.trim());
      if (user?.setupRequired) throw new Error("Choose a username to finish creating your account.");
      onComplete(user);
    } catch (e) {
      setError(e.message || "We couldn't finish setting up your account.");
      setAvailability(null);
      setBusy(false);
    }
  };

  return (
    <form className="auth-card google-username-setup" onSubmit={submit} noValidate>
      <p className="eyebrow">ONE QUICK STEP</p>
      <h2>Choose your username</h2>
      <p className="muted">This is how neighbours will recognize you on your posts and replies.</p>
      <Field id="google-username" label="Username" hint="3 to 20 letters, numbers or underscores. You can change it later." error={message}>
        <input id="google-username" autoComplete="username" autoCapitalize="none" spellCheck="false" value={username} onChange={(e) => { setUsername(e.target.value); setAvailability(null); setError(""); }} aria-invalid={!!message || undefined} />
        {availability?.ok && <p className="ok" role="status">That username is free.</p>}
      </Field>
      <p className="google-account-note">Signed in with Google as <b>{email}</b><br /><span>Your email stays private.</span></p>
      <button className="btn btn-primary btn-wide" disabled={busy || !availability?.ok}>{busy ? "Creating your account…" : "Continue to Civic Pulse"}</button>
      <button className="link-quiet google-back" type="button" onClick={onCancel}>Back to sign in</button>
    </form>
  );
}

export function Auth({ mode }) {
  const { user, signedIn, notify, route } = useApp();
  const isRegister = mode === "register";
  const [form, setForm] = useState({ username: "", email: "", identifier: "", password: "" });
  const [errors, setErrors] = useState({});
  const [uCheck, setUCheck] = useState(null); // {ok, reason} for the username field while registering
  const [busy, setBusy] = useState(false);
  const [googleSetup, setGoogleSetup] = useState(null);
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); if (errors[k]) setErrors({ ...errors, [k]: "" }); };
  const next = route.query.get("next") || "/feed";

  useEffect(() => { if (user) navigate(next); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live "is this username free?" check while registering.
  useEffect(() => {
    if (!isRegister) return;
    const u = form.username.trim();
    if (!u) return setUCheck(null);
    const t = setTimeout(() => api.usernameAvailable(u).then(setUCheck), 350);
    return () => clearTimeout(t);
  }, [form.username, isRegister]);

  const finish = (u, created = isRegister) => {
    signedIn(u);
    notify(created ? `Welcome, ${u.name}. Your account is ready.` : `Welcome back, ${u.name}.`);
    navigate(next);
  };

  const fail = (x) => {
    const field = x.field || "form";
    setErrors({ [field]: x.message });
    const el = document.getElementById(field === "form" ? "" : field);
    if (el) el.focus();
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      finish(isRegister
        ? await api.register({ username: form.username, email: form.email, password: form.password })
        : await api.signIn({ identifier: form.identifier, password: form.password }));
    } catch (x) {
      fail(x);
      setBusy(false);
    }
  };

  const onGoogle = async (credential) => {
    setBusy(true);
    setErrors({});
    try {
      const result = await api.googleSignIn(credential);
      if (result?.setupRequired) {
        setGoogleSetup({ credential, email: result.email });
        setBusy(false);
        return;
      }
      finish(result, false);
    } catch (x) {
      setErrors({ form: x.message });
      setBusy(false);
    }
  };

  const uMsg = errors.username || (uCheck && !uCheck.ok ? uCheck.reason : "");
  const uOk = isRegister && !errors.username && uCheck?.ok;

  if (googleSetup) {
    return (
      <main className="wrap auth">
        <div className="auth-side"><h1>One last step.</h1><p>Choose the name neighbours will see beside your posts and replies.</p></div>
        <GoogleUsernameSetup credential={googleSetup.credential} email={googleSetup.email} onComplete={(u) => finish(u, true)} onCancel={() => setGoogleSetup(null)} />
      </main>
    );
  }

  return (
    <main className="wrap auth">
      <div className="auth-side">
        <h1>{isRegister ? "Make your street's problems visible." : "Welcome back."}</h1>
        <p>
          {isRegister
            ? "Pick a username, post issues, join the discussion, and see how many neighbours are noticing the same thing."
            : "Pick up where you left off: your posts, comments and responses are waiting."}
        </p>
      </div>

      <form className="auth-card" onSubmit={submit} noValidate>
        <h2>{isRegister ? "Create your account" : "Sign in"}</h2>
        {errors.form && <p className="banner-err" role="alert">{errors.form}</p>}

        <GoogleButton mode={mode} onCredential={onGoogle} />
        <div className="divider"><span>or use a password</span></div>

        {isRegister ? (
          <>
            <Field id="username" label="Username" hint="3 to 20 letters, numbers or underscores. This is shown on your posts." error={uMsg}>
              <input id="username" autoComplete="username" autoCapitalize="none" spellCheck="false" value={form.username} onChange={set("username")} aria-describedby="username-hint" aria-invalid={!!uMsg || undefined} />
              {uOk && <p className="ok" role="status">That username is free.</p>}
            </Field>
            <Field id="email" label="Email" hint="Used to recover your account. It isn't shown to other people." error={errors.email}>
              <input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} aria-describedby="email-hint" aria-invalid={!!errors.email || undefined} />
            </Field>
            <Field id="password" label="Password" hint={`At least ${api.LIMITS.passwordMin} characters. Longer is stronger.`} error={errors.password}>
              <PasswordInput id="password" value={form.password} onChange={set("password")} autoComplete="new-password" describedBy="password-hint" invalid={!!errors.password} />
              <Strength password={form.password} />
            </Field>
          </>
        ) : (
          <>
            <Field id="identifier" label="Username or email" error={errors.identifier}>
              <input id="identifier" autoComplete="username" autoCapitalize="none" spellCheck="false" value={form.identifier} onChange={set("identifier")} aria-invalid={!!errors.identifier || undefined} />
            </Field>
            <Field id="password" label="Password" error={errors.password}>
              <PasswordInput id="password" value={form.password} onChange={set("password")} autoComplete="current-password" invalid={!!errors.password} />
            </Field>
          </>
        )}

        <button className="btn btn-primary btn-wide" disabled={busy}>
          {busy ? "One moment…" : isRegister ? "Create account" : "Sign in"}
        </button>
        {isRegister && <p className="fine-print">By creating an account you agree to keep posts civil and about local issues. Content can be reported and reviewed by moderators.</p>}
        <p className="switch">
          {isRegister ? <>Already have an account? <a href="#/signin">Sign in</a></> : <>New here? <a href="#/register">Create an account</a></>}
        </p>
      </form>
    </main>
  );
}
