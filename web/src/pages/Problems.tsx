import { useState } from "react";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { ErrorText, Page, useAction, useLoad, when } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProblemBrowser, { type ProblemRow } from "@/components/ProblemBrowser";
import { api, type Problem } from "@/lib/api";
import { t } from "@/lib/i18n";
import { usePreparing } from "@/lib/preparing";
import { navigate } from "@/lib/router";

type Row = ProblemRow & { last_used_at: string | null };  // PL-47: last answer uploaded or graded

/** PL-15: a title is enough to save a problem; it starts as a draft. */
export default function Problems() {
  const preparing = usePreparing();
  // a finished preparation can change a row (a regenerated ready problem is a draft again)
  const list = useLoad(() => api.get<Row[]>("/api/problems"), [preparing]);
  const stored = useLoad(() => api.get<string[]>("/api/problems/tags"), []);  // PL-41: used or not
  const [title, setTitle] = useState("");
  const act = useAction();
  const rows = list.data ?? [];
  // PL-47: the ten problems most recently used (an answer uploaded or graded), archived ones left out
  const recent = rows.filter((r) => r.last_used_at && !r.archived)
    .sort((a, b) => (a.last_used_at! < b.last_used_at! ? 1 : -1)).slice(0, 10);
  const arch = useAction();
  const archive = (r: Row) => arch.run(async () => {
    await api.patch(`/api/problems/${r.id}`, { archived: !r.archived });
    await list.reload();
  });

  return (
    <Page title={t("Problems")} actions={
      <Dialog onOpenChange={(open) => { if (!open) { setTitle(""); act.setError(null); } }}>
        <DialogTrigger asChild><Button>{t("New problem")}</Button></DialogTrigger>
        <DialogContent>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            act.run(async () => navigate(`/problems/${(await api.post<Problem>("/api/problems", { title })).id}`));
          }}>
            <DialogHeader><DialogTitle>{t("New problem")}</DialogTitle></DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="problem-name">{t("Name")}</Label>
              <Input id="problem-name" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <ErrorText>{act.error}</ErrorText>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">{t("Cancel")}</Button></DialogClose>
              <Button type="submit" disabled={!title.trim() || act.busy}>{t("Create problem")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    }>
      <ErrorText>{list.error ?? arch.error}</ErrorText>
      {list.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("No problems yet. Use New problem to start one.")}</p>}
      {recent.length > 0 && (
        <section aria-labelledby="recent-title" className="space-y-2">
          <h2 id="recent-title" className="text-sm font-semibold">{t("Recently used")}</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]">
            {recent.map((p) => (
              <li key={p.id}>
                <a href={`/problems/${p.id}`} onClick={(e) => { e.preventDefault(); navigate(`/problems/${p.id}`); }}
                   className="flex h-full flex-col gap-1 rounded-lg border bg-card p-3 hover:bg-accent">
                  <span className="truncate font-medium" title={p.title}>{p.title}</span>
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{when(p.last_used_at!)}</span>
                    {p.status === "ready" ? <Badge>{t("Ready · v{n}", { n: p.rubric_version })}</Badge> : <Badge variant="outline">{t("Draft")}</Badge>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rows.length > 0 && (<>
        {recent.length > 0 && <h2 className="pt-2 text-sm font-semibold">{t("All problems")}</h2>}
        <ProblemBrowser rows={rows} allTags={stored.data ?? []}
          afterTitle={(p) => preparing.has(p.id) && (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" role="status" aria-label={t("Preparing the AI grader")} />
          )}
          meta={(p) => <span className="hidden sm:inline">{when(p.updated_at)}</span>}
          actions={(p) => (
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" disabled={arch.busy}
                    aria-label={t(p.archived ? "Unarchive {title}" : "Archive {title}", { title: p.title })}
                    title={t(p.archived ? "Unarchive" : "Archive")} onClick={() => archive(p)}>
              {p.archived ? <ArchiveRestore /> : <Archive />}
            </Button>
          )} />
      </>)}
    </Page>
  );
}
