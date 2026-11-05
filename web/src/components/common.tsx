import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { AnswerState } from "@/lib/api";
import { getLang, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Load data once and on demand; errors are shown, never swallowed. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(
    () => load().then((d) => { setData(d); setError(null); }, (e) => setError(e.message)),
    deps, // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, setData, error, reload };
}

/** Run an action with a busy flag and a visible error. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  // server messages are English; known ones have a translation (PL-37)
  return <p role="alert" className="text-sm text-destructive">{t(children)}</p>;
}

const STATE: Record<AnswerState, [string, string]> = {
  not_graded: ["Not graded", "bg-muted text-muted-foreground"],
  running: ["Grading…", "bg-accent text-accent-foreground animate-pulse"],
  proposed: ["Draft proposal", "bg-primary/15 text-foreground border-primary/40"],
  review_required: ["Review required", "bg-warning/20 text-foreground border-warning"],
  failed: ["Failed — no score", "bg-destructive/15 text-destructive border-destructive/40"],
  approved: ["Approved", "bg-success/20 text-foreground border-success"],
};

export function StateBadge({ state }: { state: AnswerState }) {
  const [label, cls] = STATE[state];
  return <Badge variant="outline" className={cn("whitespace-nowrap", cls)}>{t(label)}</Badge>;
}

/** PL-38: the trail shown on the left of the top bar; the last item is the current page. */
export type Crumb = [label: string, to?: string];
export const CrumbsContext = createContext<(c: Crumb[]) => void>(() => {});

export function useCrumbs(crumbs: Crumb[]) {
  const set = useContext(CrumbsContext);
  const key = JSON.stringify(crumbs);
  useEffect(() => set(JSON.parse(key)), [key, set]);
}

export function Page({ title, crumbs = [], actions, children }: {
  title: string; crumbs?: Crumb[]; actions?: React.ReactNode; children: React.ReactNode;
}) {
  useCrumbs([...crumbs, [title]]);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="min-w-0 break-words text-xl font-semibold sm:text-2xl">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export const usd = (n: number | null | undefined) => (n == null ? "—" : `$${n.toFixed(n < 1 ? 4 : 2)}`);
export const when = (iso: string) => new Date(iso).toLocaleString(getLang());
export const pts = (n: number | null | undefined) => (n == null ? "—" : Number(n.toFixed(2)).toString());
