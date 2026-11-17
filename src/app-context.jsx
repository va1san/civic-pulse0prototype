import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as api from "./database.js";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = h.split("?");
  return { parts: path.split("/").filter(Boolean), query: new URLSearchParams(query) };
}

export const navigate = (to) => {
  window.location.hash = to;
};

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => api.currentUser());
  const [route, setRoute] = useState(parseHash);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let active = true;
    api.getSessionUser().then((u) => { if (active) setUser(u); }).catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, []);

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(notify.t);
    notify.t = window.setTimeout(() => setToast(null), 3600);
  }, []);

  const value = {
    user,
    route,
    notify,
    toast,
    signedIn: (u) => setUser(u),
    signOut: () => {
      Promise.resolve(api.signOut()).catch(() => {});
      setUser(null);
      navigate("/");
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
