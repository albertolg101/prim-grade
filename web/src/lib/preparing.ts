import { useSyncExternalStore } from "react";
import { api, type Problem } from "@/lib/api";

/** PL-43: the problems the server is preparing an AI grader for. Every open tab polls the same server
 * state, so a preparation started in one tab, or before a reload, shows everywhere. Polling runs only
 * while something on screen uses it. ponytail: polling; server-sent events if the delay matters. */
const BUSY_MS = 2000, IDLE_MS = 5000;
let ids: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

const set = (next: ReadonlySet<string>) => {
  if (next.size === ids.size && [...next].every((x) => ids.has(x))) return;
  ids = next;
  listeners.forEach((l) => l());
};

async function poll() {
  clearTimeout(timer);
  try {
    set(new Set(await api.get<string[]>("/api/problems/preparing")));
  } catch {
    // only an indicator: keep the last known state and try again on the next tick
  }
  if (listeners.size) timer = setTimeout(poll, ids.size ? BUSY_MS : IDLE_MS);
}
const now = () => { if (listeners.size && document.visibilityState === "visible") poll(); };

/** Start a preparation; the problem comes back marked as preparing (202), the result arrives later. */
export async function generate(id: string): Promise<Problem> {
  const p = await api.post<Problem>(`/api/problems/${id}/generate`);
  set(new Set(ids).add(id));
  poll();
  return p;
}

export function usePreparing(): ReadonlySet<string> {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    if (listeners.size === 1) { poll(); document.addEventListener("visibilitychange", now); }
    return () => {
      listeners.delete(l);
      if (!listeners.size) { clearTimeout(timer); document.removeEventListener("visibilitychange", now); }
    };
  }, () => ids);
}
