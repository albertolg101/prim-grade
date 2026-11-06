import { useEffect, useState } from "react";

/** Minimal history router: the app has a dozen flat routes, no nesting. */
export function navigate(to: string) {
  history.pushState(null, "", to);
  scrollTo(0, 0);
  dispatchEvent(new PopStateEvent("popstate"));
}

export function useLocation() {
  const [loc, setLoc] = useState(() => location.pathname + location.search);
  useEffect(() => {
    const on = () => setLoc(location.pathname + location.search);
    addEventListener("popstate", on);
    return () => removeEventListener("popstate", on);
  }, []);
  return loc;
}

/** match("/problems/:id", "/problems/42") -> { id: "42" } */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/"), b = path.split("?")[0].split("/");
  if (a.length !== b.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) out[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return out;
}

export function query(name: string) {
  return new URLSearchParams(location.search).get(name);
}
