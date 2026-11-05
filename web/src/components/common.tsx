import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/** The page title; with onRename, a pencil turns it into a text input (Enter or leaving saves, Esc cancels). */
function Title({ title, onRename }: { title: string; onRename?: (title: string) => Promise<unknown> }) {
  const [edit, setEdit] = useState<string | null>(null);
  const saving = useRef(false);  // set while saving, and after Esc, so a late blur saves nothing
  if (edit === null) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {onRename && (
          <Button size="icon" variant="ghost" aria-label={t("Rename")} title={t("Rename")} onClick={() => { saving.current = false; setEdit(title); }}>
            <Pencil />
          </Button>
        )}
      </div>
    );
  }
  const done = async () => {
    if (saving.current) return;  // Enter and the blur that follows save once
    saving.current = true;
    const next = edit.trim();
    if (next && next !== title) await onRename!(next);
    setEdit(null);
  };
  return (
    <form className="flex min-w-0 flex-1 items-center" onSubmit={(e) => { e.preventDefault(); done(); }}>
      <Input autoFocus onFocus={(e) => e.target.select()} aria-label={t("Title")} value={edit} onChange={(e) => setEdit(e.target.value)} onBlur={done}
             onKeyDown={(e) => { if (e.key === "Escape") { saving.current = true; setEdit(null); } }}
             className="h-12 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl md:text-3xl" />
    </form>
  );
}

export function Page({ title, onRename, crumbs = [], actions, children }: {
  title: string; onRename?: (title: string) => Promise<unknown>; crumbs?: Crumb[]; actions?: React.ReactNode; children: React.ReactNode;
}) {
  useCrumbs([...crumbs, [title]]);
  return (
    <div className="w-full space-y-4 px-4 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Title title={title} onRename={onRename} />
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export const usd = (n: number | null | undefined) => (n == null ? "—" : `$${n.toFixed(n < 1 ? 4 : 2)}`);
export const when = (iso: string) => new Date(iso).toLocaleString(getLang());
export const pts = (n: number | null | undefined) => (n == null ? "—" : Number(n.toFixed(2)).toString());
