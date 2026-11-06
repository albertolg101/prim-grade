import { useState } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { ErrorText, Page, useAction, useLoad } from "@/components/common";
import TagInput from "@/components/TagInput";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Exam } from "@/lib/api";
import { t } from "@/lib/i18n";
import { navigate } from "@/lib/router";

type ProblemRow = { id: string; title: string; status: string; archived: boolean };

/** PL-26: exams group problems and are given to one or more groups. */
export default function Exams() {
  const list = useLoad(() => api.get<Exam[]>("/api/exams"), []);
  return (
    <Page title={t("Exams")} actions={<NewExam />}>
      <ErrorText>{list.error}</ErrorText>
      {list.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("No exams yet.")}</p>}
      {!!list.data?.length && <Card className="divide-y gap-0 overflow-hidden py-0">
        {list.data.map((e) => (
          <a key={e.id} href={`/exams/${e.id}`} onClick={(ev) => { ev.preventDefault(); navigate(`/exams/${e.id}`); }}
             className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent">
            <span className="min-w-0 truncate font-medium">{e.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("Problems: {n}", { n: e.problems.length })} · {e.groups.map((g) => g.name).join(", ") || t("no group")}
            </span>
          </a>
        ))}
      </Card>}
    </Page>
  );
}

/** PL-52: a title and, optionally, existing problems picked with an autocomplete and put in exam order. */
function NewExam() {
  const problems = useLoad(() => api.get<ProblemRow[]>("/api/problems"), []);
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<ProblemRow[]>([]);
  const act = useAction();
  const reset = () => { setTitle(""); setPicked([]); act.setError(null); };
  const move = (i: number, d: number) => { const p = [...picked]; [p[i], p[i + d]] = [p[i + d], p[i]]; setPicked(p); };
  const free = (problems.data ?? []).filter((p) => !p.archived && !picked.some((x) => x.id === p.id));

  return (
    <Dialog onOpenChange={(o) => { if (!o) reset(); }}>
      <DialogTrigger asChild><Button>{t("New exam")}</Button></DialogTrigger>
      <DialogContent>
        <form className="min-w-0 space-y-4" onSubmit={(e) => {
          e.preventDefault();
          act.run(async () => navigate(`/exams/${(await api.post<Exam>("/api/exams", { title, problem_ids: picked.map((p) => p.id) })).id}`));
        }}>
          <DialogHeader><DialogTitle>{t("New exam")}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="exam-title">{t("Title")}</Label>
            <Input id="exam-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium">{t("Problems, in exam order")}</p>
            {picked.length > 0 && (
              <ol className="divide-y rounded-md border">
                {picked.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                    <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate" title={p.title}>{p.title}</span>
                    {p.status !== "ready" && <span className="shrink-0 text-xs text-muted-foreground">{t("Draft")}</span>}
                    <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === 0}
                            aria-label={t("Move {title} up", { title: p.title })} onClick={() => move(i, -1)}><ArrowUp /></Button>
                    <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === picked.length - 1}
                            aria-label={t("Move {title} down", { title: p.title })} onClick={() => move(i, 1)}><ArrowDown /></Button>
                    <Button type="button" variant="ghost" size="icon" className="size-7"
                            aria-label={t("Remove {name}", { name: p.title })} onClick={() => setPicked(picked.filter((x) => x.id !== p.id))}><X /></Button>
                  </li>
                ))}
              </ol>
            )}
            {problems.data && (problems.data.length === 0
              ? <p className="text-xs text-muted-foreground">{t("No problems yet. You can add them to the exam later.")}</p>
              : <TagInput label={t("Add a problem")} placeholder={t("Type a problem name…")} noMatch="No problem matches “{q}”."
                          suggestions={free.map((p) => ({ value: p.title }))}
                          // ponytail: two problems with one name add the most recently changed; show more if names repeat
                          onPick={(name) => { const p = free.find((x) => x.title === name); if (p) setPicked([...picked, p]); }} />)}
          </div>
          <ErrorText>{act.error ?? problems.error}</ErrorText>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">{t("Cancel")}</Button></DialogClose>
            <Button type="submit" disabled={!title.trim() || act.busy}>{t("Create exam")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
