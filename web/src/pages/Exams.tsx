import { useState } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Filter, Search, X } from "lucide-react";
import { ErrorText, Page, useAction, useLoad, when } from "@/components/common";
import { ALL_TIME, DateFilter, bounds } from "@/components/DateRange";
import TagInput from "@/components/TagInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type Exam } from "@/lib/api";
import { t } from "@/lib/i18n";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

type ProblemRow = { id: string; title: string; status: string; archived: boolean };
type State = "active" | "archived";
type Sort = "used" | "created" | "name-asc" | "name-desc";
const SORTS: [Sort, string][] = [["used", "Recently used"], ["created", "Recently created"], ["name-asc", "Name A–Z"], ["name-desc", "Name Z–A"]];
const lower = (s: string) => s.toLocaleLowerCase();
const stateOf = (e: Exam): State => (e.archived ? "archived" : "active");
const open = (id: string) => (ev: React.MouseEvent) => { ev.preventDefault(); navigate(`/exams/${id}`); };

/** PL-26, PL-56: exams like the problems and groups: recently used, then a search bar, the list and a
 * filter panel. */
export default function Exams() {
  const list = useLoad(() => api.get<Exam[]>("/api/exams"), []);
  const arch = useAction();
  const [q, setQ] = useState("");
  const [states, setStates] = useState<State[]>(["active"]);  // none checked: nothing shown
  const [sort, setSort] = useState<Sort>("used");
  const [created, setCreated] = useState(ALL_TIME);
  const [groups, setGroups] = useState<string[]>([]);  // names; an exam given to any of them
  const [showFilters, setShowFilters] = useState(false);  // phones only; always shown on wide screens
  const rows = list.data ?? [];
  const words = lower(q).split(/\s+/).filter(Boolean);
  const [lo, hi] = bounds(created);
  const allGroups = [...new Set(rows.flatMap((e) => e.groups.map((g) => g.name)))].sort((a, b) => a.localeCompare(b));
  const shown = rows.filter((e) => states.includes(stateOf(e))
    && words.every((w) => lower(e.title).includes(w) || e.problems.some((p) => lower(p.title).includes(w)) || e.groups.some((g) => lower(g.name).includes(w)))
    && (!lo || new Date(e.created_at) >= lo) && (!hi || new Date(e.created_at) < hi)
    && (!groups.length || e.groups.some((g) => groups.includes(g.name))))
    .sort((a, b) => sort === "name-asc" ? a.title.localeCompare(b.title) : sort === "name-desc" ? b.title.localeCompare(a.title)
      : sort === "created" ? (a.created_at < b.created_at ? 1 : -1) : (a.last_used_at < b.last_used_at ? 1 : -1));
  const recent = rows.filter((e) => !e.archived).sort((a, b) => (a.last_used_at < b.last_used_at ? 1 : -1)).slice(0, 10);
  const nFilters = (states.length === 1 && states[0] === "active" ? 0 : 1) + (created.range === "all" ? 0 : 1) + groups.length;
  const archive = (e: Exam) => arch.run(async () => { await api.patch(`/api/exams/${e.id}`, { archived: !e.archived }); await list.reload(); });
  const meta = (e: Exam) => `${t("Problems: {n}", { n: e.problems.length })} · ${e.groups.map((g) => g.name).join(", ") || t("no group")}`;

  return (
    <Page title={t("Exams")} actions={<NewExam />}>
      <ErrorText>{list.error ?? arch.error}</ErrorText>
      {list.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("No exams yet.")}</p>}
      {recent.length > 0 && (
        <section aria-labelledby="recent-exams" className="space-y-2">
          <h2 id="recent-exams" className="text-sm font-semibold">{t("Recently used")}</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]">
            {recent.map((e) => (
              <li key={e.id}>
                <a href={`/exams/${e.id}`} onClick={open(e.id)} className="flex h-full flex-col gap-1 rounded-lg border bg-card p-3 hover:bg-accent">
                  <span className="truncate font-medium" title={e.title}>{e.title}</span>
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{when(e.last_used_at)}</span>
                    <span className="shrink-0">{t("Problems: {n}", { n: e.problems.length })}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rows.length > 0 && (<>
        <h2 className="pt-2 text-sm font-semibold">{t("All exams")}</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" aria-label={t("Search exams")} placeholder={t("Search by exam, problem or group")}
                   className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant="outline" className="lg:hidden" aria-expanded={showFilters} aria-controls="exam-filters"
                  onClick={() => setShowFilters(!showFilters)}>
            <Filter /> {t("Filters")}{nFilters ? ` · ${nFilters}` : ""}
          </Button>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-xs text-muted-foreground" aria-live="polite">{t("{n} of {total} exams", { n: shown.length, total: rows.length })}</p>
            {shown.length === 0 && <p className="text-sm text-muted-foreground">{t("No exam matches the search and filters.")}</p>}
            {shown.length > 0 && <Card className="divide-y gap-0 overflow-hidden py-0">
              {shown.map((e) => (
                <div key={e.id} className="flex items-center hover:bg-accent">
                  <a href={`/exams/${e.id}`} onClick={open(e.id)}
                     className={cn("flex min-w-0 flex-1 items-center justify-between gap-3 py-3 pl-4", e.archived && "text-muted-foreground")}>
                    <span className="min-w-0 truncate font-medium">{e.title}</span>
                    <span className="flex min-w-0 shrink items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{meta(e)}</span>
                      <span className="hidden shrink-0 sm:inline">{when(e.last_used_at)}</span>
                      {e.archived && <Badge variant="secondary">{t("Archived")}</Badge>}
                    </span>
                  </a>
                  <Button variant="ghost" size="icon" className="mx-2 size-8 shrink-0 text-muted-foreground" disabled={arch.busy}
                          aria-label={t(e.archived ? "Unarchive {title}" : "Archive {title}", { title: e.title })}
                          title={t(e.archived ? "Unarchive" : "Archive")} onClick={() => archive(e)}>
                    {e.archived ? <ArchiveRestore /> : <Archive />}
                  </Button>
                </div>
              ))}
            </Card>}
          </div>
          <aside id="exam-filters" aria-label={t("Filters")}
                 className={cn("order-first space-y-4 rounded-lg border p-4 lg:order-last lg:sticky lg:top-17 lg:block lg:w-60 lg:shrink-0", !showFilters && "hidden")}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("Filters")}</h2>
              <Button size="sm" variant="ghost" className="h-7" disabled={!nFilters}
                      onClick={() => { setStates(["active"]); setCreated(ALL_TIME); setGroups([]); }}>{t("Clear")}</Button>
            </div>
            <div className="space-y-2">
              <p id="exam-sort" className="text-xs font-medium text-muted-foreground">{t("Sort by")}</p>
              <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <SelectTrigger size="sm" className="w-full" aria-labelledby="exam-sort"><SelectValue /></SelectTrigger>
                <SelectContent position="popper">{SORTS.map(([id, label]) => <SelectItem key={id} value={id}>{t(label)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-medium text-muted-foreground">{t("Status")}</legend>
              {([["active", t("Active")], ["archived", t("Archived")]] as const).map(([st, label]) => (
                <label key={st} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={states.includes(st)}
                            onCheckedChange={() => setStates(states.includes(st) ? states.filter((x) => x !== st) : [...states, st])} />
                  {label} <span className="text-xs text-muted-foreground">{rows.filter((e) => stateOf(e) === st).length}</span>
                </label>
              ))}
            </fieldset>
            <DateFilter title={t("Created")} value={created} onChange={setCreated} />
            <fieldset className="min-w-0 space-y-2">
              <legend className="mb-2 text-xs font-medium text-muted-foreground">{t("Group")}{groups.length ? ` · ${groups.length}` : ""}</legend>
              {allGroups.length === 0 && <p className="text-xs text-muted-foreground">{t("No groups yet")}</p>}
              {groups.length > 0 && (
                <ul className="flex flex-wrap gap-1">
                  {groups.map((x) => (
                    <li key={x}>
                      <Badge variant="secondary" className="max-w-full gap-0.5 pr-0.5">
                        <span className="truncate" title={x}>{x}</span>
                        <button type="button" aria-label={t("Remove group {name}", { name: x })}
                                className="rounded-full p-0.5 hover:bg-background/60" onClick={() => setGroups(groups.filter((y) => y !== x))}><X className="size-3" /></button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              {allGroups.length > 0 && (
                <TagInput label={t("Filter by group")} placeholder={t("Type a group…")} noMatch="No group matches “{q}”."
                          suggestions={allGroups.filter((x) => !groups.includes(x)).map((x) => ({
                            value: x, hint: String(rows.filter((e) => e.groups.some((g) => g.name === x)).length),
                          }))}
                          onPick={(x) => setGroups([...groups, x])} />
              )}
            </fieldset>
          </aside>
        </div>
      </>)}
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
