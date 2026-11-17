// LANDING PAGE: the first screen visitors see (route: #/).
import { useState } from "react";
import * as api from "./database.js";
import { GoogleButton, GoogleUsernameSetup, PasswordInput } from "./secondary-pages.jsx";
import { navigate, useApp } from "./app-context.jsx";

// Compact sign-in card for the hero: Google, or username/email + password.
function QuickAuth() {
  const { signedIn, notify } = useApp();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleSetup, setGoogleSetup] = useState(null);
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setError(""); };

  const done = (u, created = false) => {
    signedIn(u);
    notify(created ? `Welcome, ${u.name}. Your account is ready.` : `Welcome back, ${u.name}.`);
    navigate("/feed");
  };
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      done(await api.signIn(form));
    } catch (x) {
      setError(x.message);
      setBusy(false);
    }
  };
  const onGoogle = async (credential) => {
    setBusy(true);
    setError("");
    try {
      const result = await api.googleSignIn(credential);
      if (result?.setupRequired) {
        setGoogleSetup({ credential, email: result.email });
        setBusy(false);
        return;
      }
      done(result);
    } catch (x) {
      setError(x.message);
      setBusy(false);
    }
  };

  if (googleSetup) {
    return <GoogleUsernameSetup credential={googleSetup.credential} email={googleSetup.email} onComplete={(u) => done(u, true)} onCancel={() => setGoogleSetup(null)} />;
  }

  return (
    <form className="quick-auth" onSubmit={submit} noValidate aria-label="Sign in">
      <GoogleButton mode="signin" onCredential={onGoogle} />
      <div className="divider"><span>or</span></div>
      {error && <p className="banner-err" role="alert">{error}</p>}
      <label className="sr" htmlFor="qa-id">Username or email</label>
      <input id="qa-id" placeholder="Username or email" autoComplete="username" autoCapitalize="none" spellCheck="false" value={form.identifier} onChange={set("identifier")} />
      <label className="sr" htmlFor="qa-pw">Password</label>
      <PasswordInput id="qa-pw" placeholder="Password" value={form.password} onChange={set("password")} autoComplete="current-password" />
      <button className="btn btn-primary btn-wide" disabled={busy}>{busy ? "One moment…" : "Sign in"}</button>
      <p className="qa-switch">New here? <a href="#/register">Create an account</a></p>
    </form>
  );
}

// Phone mockup in the hero: a sample issue with a live "This affects me" button.
function PhoneMock() {
  const [on, setOn] = useState(false);
  const count = 41 + (on ? 1 : 0);
  return (
    <figure className="phone-wrap" aria-label="Preview of an issue on Civic Pulse">
      <div className="phone-glow" aria-hidden="true" />
      <div className="phone">
        <div className="ph-notch" aria-hidden="true" />
        <div className="ph-status" aria-hidden="true"><span>9:41</span><span>●●●</span></div>
        <div className="ph-head">
          <svg viewBox="0 0 64 64" width="22" height="22" aria-hidden="true">
            <g transform="translate(7 0)">
              <path d="M37.51 17.91A17 17 0 1 0 37.51 46.09" fill="none" stroke="#DB2C70" strokeWidth="10.5" strokeLinecap="round" />
              <circle cx="28" cy="32" r="5.2" fill="#FF7A3D" />
              <path d="M50.65 15.54A28 28 0 1 0 50.65 48.46" fill="none" stroke="#FF7A3D" strokeWidth="3.6" strokeLinecap="round" opacity=".75" />
            </g>
          </svg>
          <b>Issue</b>
        </div>

        <div className="ph-body">
          <svg className="ph-photo" viewBox="0 0 280 150" role="img" aria-label="Illustration of an open drain beside a school gate">
            <rect width="280" height="150" fill="#FBE3DA" />
            <rect x="0" y="40" width="280" height="46" fill="#EBC3B3" />
            <g fill="#C98E7C"><rect x="20" y="24" width="14" height="62" /><rect x="116" y="24" width="14" height="62" /></g>
            <g stroke="#9C6A5B" strokeWidth="3"><path d="M40 40v46M52 40v46M64 40v46M76 40v46M88 40v46M100 40v46" /></g>
            <rect x="20" y="20" width="110" height="8" rx="3" fill="#9C6A5B" />
            <rect y="92" width="280" height="58" fill="#5B5068" />
            <rect y="84" width="280" height="12" fill="#C9BFC8" />
            <rect x="92" y="106" width="96" height="34" rx="4" fill="#1B1330" />
            <g stroke="#7A6D88" strokeWidth="3" strokeLinecap="round"><path d="M110 112v22M126 112v22" /></g>
            <path d="M204 142l13-38 13 38z" fill="#FF7A3D" />
            <rect x="199" y="140" width="36" height="6" rx="2" fill="#231A3A" />
            <path d="M210 128h14M212 118h10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="chip">Roads and footpaths</span>
          <p className="ph-title">Open drain cover outside the school gate on 11th Main.</p>
          <p className="ph-meta">Meera · 1 day ago</p>

          <button
            type="button"
            className={"ph-affect" + (on ? " on" : "")}
            aria-pressed={on}
            onClick={() => setOn(!on)}
          >
            {on ? "You said this affects you" : "This affects me"}
          </button>
          <p className="ph-count"><b>{count}</b> people say it affects them</p>

          <div className="ph-thread">
            <p><b>Anita</b> Saw it this morning too. The cover is missing completely.</p>
            <p><b>Rohan</b> I put a branch in it as a warning. Needs a proper fix.</p>
          </div>
        </div>
      </div>
      <figcaption className="phone-cap">Sample post. Tap the button to try it.</figcaption>
    </figure>
  );
}

export function Landing() {
  const { user } = useApp();

  return (
    <main>
      <section className="hero">
        <div className="wrap hero-split">
          <div className="hero-copy">
            <svg className="hero-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
              <g transform="translate(7 0)">
                <path d="M37.51 17.91A17 17 0 1 0 37.51 46.09" fill="none" stroke="#DB2C70" strokeWidth="10.5" strokeLinecap="round" />
                <circle cx="28" cy="32" r="5.2" fill="#FF7A3D" />
                <path d="M50.65 15.54A28 28 0 1 0 50.65 48.46" fill="none" stroke="#FF7A3D" strokeWidth="3.6" strokeLinecap="round" />
              </g>
            </svg>
            <h1>The pothole outside your gate is also outside everyone else's.</h1>
            <p className="lead">Post local issues, talk them through, and see where reports pile up.</p>
            {user ? (
              <div className="cta-row">
                <a className="btn btn-primary btn-lg" href="#/new">Report an issue</a>
              </div>
            ) : (
              <QuickAuth />
            )}
          </div>
          <PhoneMock />
        </div>
      </section>

      <section className="wrap steps">
        <h2>How it works</h2>
        <ol>
          <li>
            <h3>Post what you see</h3>
            <p>Describe it in a few lines, pick a category, add one photo if it helps, and mark the spot on the map. We never take your location without you asking.</p>
          </li>
          <li>
            <h3>Talk it through</h3>
            <p>Each issue has its own discussion. Neighbours add details and what they've seen, all in one place.</p>
          </li>
          <li>
            <h3>Say if it affects you</h3>
            <p>One tap shows others it matters to you too. It's a signal of impact, not a verification of the report.</p>
          </li>
        </ol>
      </section>

      <section className="scope">
        <div className="wrap scope-in">
          <h2>What this is, and isn't</h2>
          <p>Civic Pulse is a shared space for residents. It is not a government service, and reports are not sent to, owned by, or resolved by any government body.</p>
        </div>
      </section>
    </main>
  );
}
