# Civic Pulse web (React + Vite + OpenStreetMap)

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints. The map uses OpenStreetMap tiles and doesn't need an API token.

## What works today

Landing, register / sign in, issue feed with sorting, post an issue (category, optional one photo, map location),
issue detail with comments, "Does this affect you?" (one per user), report issue or comment, map with report density.

## Backend hookup

`src/database.js` is a mock that stores everything in the browser. Each exported function maps to one REST call
(see the comments). Replace the bodies with `fetch("/api/...")`; the Vite dev server already proxies `/api`
to `http://localhost:3000` (see `vite.config.js`). Auth, roles, rate limits and moderation must be enforced on the server.

## Assumptions to confirm (from the requirements' open decisions)

- Location is required when posting. Public pins are rounded to about 110 m.
- Photo: JPG, PNG or WebP, max 5 MB, downscaled to 900 px.
- Categories: the 7 listed in `src/database.js`.
- Users can remove their "affects me" response.
- Report reasons: 4 listed in `src/database.js`. Repeat reports by the same user are ignored.
- Map density uses all issues; a time window is not applied yet.

## File map (src/)

| File | What it is |
| --- | --- |
| `main.jsx` | Main file: entry point where everything is integrated and routed |
| `landing-page.jsx` | Landing page |
| `database.js` | Database / data layer (mock now, backend later) |
| `secondary-pages.jsx` | Feed, post an issue, issue detail, sign in and register |
| `mapbox-pages.jsx` | Map page |
| `mapbox-map.jsx` | Interactive OpenStreetMap view, report pins and location picker |
| `shared-components.jsx` | Header, footer, cards, forms, report dialog |
| `app-context.jsx` | Signed-in user, routing and toast state |
| `styles.css` | All styling and colour tokens |

## Quick view with VS Code Live Server (no Node needed to just look)

Open `dist/index.html` with Live Server (right-click, Open with Live Server). Do NOT open the root `index.html`:
that one is source code and only works through `npm run dev`. After any code change, run `npm run build` to refresh `dist/`.
The map requests only visible tiles and includes OpenStreetMap attribution. The standard OSM tile service is best-effort and intended for normal interactive use; review its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) before launching to a large audience.

## Accounts and Google sign-in

Register with a username, email and password, or continue with Google. Sign in with username or email.
Accounts are stored in the browser for now (`src/database.js`): passwords are salted and hashed with PBKDF2, but this is a demo.
The real backend must do the hashing (argon2id or bcrypt), sessions (httpOnly cookie), rate limiting, and verify Google ID tokens.

To turn on Google: create an OAuth client ID (type "Web application") at https://console.cloud.google.com/apis/credentials,
add `http://localhost:5173` under Authorised JavaScript origins, paste the ID into `.env` as `VITE_GOOGLE_CLIENT_ID`, restart `npm run dev`.
Other providers (GitHub, Microsoft) need a server to exchange the login code, so they wait for the backend.
