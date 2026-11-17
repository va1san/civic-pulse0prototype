// MAIN: entry point where everything is integrated. Routes are hash based (#/feed, #/map, ...).
import React from "react";
import { createRoot } from "react-dom/client";
import { AppProvider, useApp } from "./app-context.jsx";
import { BottomNav, DesktopHomeLogo, Footer, Header, Toast } from "./shared-components.jsx";
import { Landing } from "./landing-page.jsx";
import { MapPage } from "./mapbox-pages.jsx";
import { Auth, Feed, IssueDetail, NewIssue, NotificationsPage, Profile, SearchPage, UserProfilePage } from "./secondary-pages.jsx";
import "./styles.css";

function Router() {
  const { route, user } = useApp();
  const [first, second] = route.parts;
  switch (first) {
    case undefined: return user ? <Feed /> : <Landing />;
    case "feed": return <Feed />;
    case "search": return <SearchPage />;
    case "notifications": return <NotificationsPage />;
    case "profile": return <Profile />;
    case "user": return second ? <UserProfilePage username={decodeURIComponent(second)} /> : <SearchPage />;
    case "map": return <MapPage />;
    case "new": return <NewIssue />;
    case "issue": return second ? <IssueDetail id={second} /> : <Feed />;
    case "signin": return <Auth key="signin" mode="signin" />;
    case "register": return <Auth key="register" mode="register" />;
    default:
      return (
        <main className="wrap page narrow">
          <h1 className="h1-sm">Page not found</h1>
          <p className="muted">That page doesn't exist. <a href="#/">Go home</a> or <a href="#/feed">browse issues</a>.</p>
        </main>
      );
  }
}

function App() {
  return (
    <AppProvider>
      <a className="skip" href="#content">Skip to content</a>
      <Header />
      <DesktopHomeLogo />
      <div id="content"><Router /><BottomNav /></div>
      <Footer />
      <Toast />
    </AppProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
