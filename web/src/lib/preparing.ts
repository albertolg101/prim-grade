import { useSyncExternalStore } from "react";
import { api, type Problem } from "@/lib/api";

/** Problems whose AI grader is being prepared in this tab, so the sidebar and the Problems list can
 * show it while the teacher looks elsewhere. ponytail: only this browser tab knows; a server-side
 * "preparing" state is needed if other tabs or a reload must see it too. */
let ids: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
const set = (next: Set<string>) => { ids = next; listeners.forEach((l) => l()); };

export async function generate(id: string): Promise<Problem> {
  set(new Set(ids).add(id));
  try {
    return await api.post<Problem>(`/api/problems/${id}/generate`);
  } finally {
    const next = new Set(ids);
    next.delete(id);
    set(next);
  }
}

export function usePreparing(): ReadonlySet<string> {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => ids);
}
