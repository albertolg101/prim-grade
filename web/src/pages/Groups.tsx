import { useState } from "react";
import { Archive, ArchiveRestore, Filter, Search } from "lucide-react";
import { ErrorText, Page, useAction, useLoad, when } from "@/components/common";
import { ALL_TIME, DateFilter, bounds } from "@/components/DateRange";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api, type Group } from "@/lib/api";
import { t } from "@/lib/i18n";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

type State = "active" | "archived";
type Sort = "used" | "created" | "name-asc" | "name-desc";
const SORTS: [Sort, string][] = [["used", "Recently used"], ["created", "Recently created"], ["name-asc", "Name A–Z"], ["name-desc", "Name Z–A"]];
const lower = (s: string) => s.toLocaleLowerCase();
const stateOf = (g: Group): State => (g.archived ? "archived" : "active");
const open = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); navigate(`/groups/${id}`); };

/** PL-25, PL-51: groups like the problems: recently used, then a search bar, the list and a filter panel. */
export default function Groups() {
  const list = useLoad(() => api.get<Group[]>("/api/groups"), []);
  const [name, setName] = useState("");
  const act = useAction();
  const arch = useAction();
  const [q, setQ] = useState("");
  const [states, setStates] = useState<State[]>(["active"]);  // none checked: nothing shown
  const [sort, setSort] = useState<Sort>("used");
  const [created, setCreated] = useState(ALL_TIME);
  const [showFilters, setShowFilters] = useState(false);  // phones only; always shown on wide screens
  const rows = list.data ?? [];
  const words = lower(q).split(/\s+/).filter(Boolean);
  const [lo, hi] = bounds(created);
  const shown = rows.filter((g) => states.includes(stateOf(g))
    && words.every((w) => lower(g.name).includes(w) || g.students.some((s) => lower(s).includes(w)))
    && (!lo || new Date(g.created_at) >= lo) && (!hi || new Date(g.created_at) < hi))
    .sort((a, b) => sort === "name-asc" ? a.name.localeCompare(b.name) : sort === "name-desc" ? b.name.localeCompare(a.name)
      : sort === "created" ? (a.created_at < b.created_at ? 1 : -1) : (a.last_used_at < b.last_used_at ? 1 : -1));
  const recent = rows.filter((g) => !g.archived).sort((a, b) => (a.last_used_at < b.last_used_at ? 1 : -1)).slice(0, 10);
  const nFilters = (states.length === 1 && states[0] === "active" ? 0 : 1) + (created.range === "all" ? 0 : 1);
  const archive = (g: Group) => arch.run(async () => { await api.patch(`/api/groups/${g.id}`, { archived: !g.archived }); await list.reload(); });

  return (
    <Page title={t("Groups")} actions={
      <Dialog onOpenChange={(o) => { if (!o) { setName(""); act.setError(null); } }}>
        <DialogTrigger asChild><Button>{t("New group")}</Button></DialogTrigger>
        <DialogContent>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            act.run(async () => navigate(`/groups/${(await api.post<Group>("/api/groups", { name })).id}`));
          }}>
            <DialogHeader><DialogTitle>{t("New group")}</DialogTitle></DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="group-name">{t("Name")}</Label>
              <Input id="group-name" autoFocus placeholder={t("e.g. Mechanics A")} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <ErrorText>{act.error}</ErrorText>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">{t("Cancel")}</Button></DialogClose>
              <Button type="submit" disabled={!name.trim() || act.busy}>{t("Create group")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    }>
      <ErrorText>{list.error ?? arch.error}</ErrorText>
      {list.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("No groups yet. Use New group to start one.")}</p>}
      {recent.length > 0 && (
        <section aria-labelledby="recent-groups" className="space-y-2">
          <h2 id="recent-groups" className="text-sm font-semibold">{t("Recently used")}</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]">
            {recent.map((g) => (
              <li key={g.id}>
                <a href={`/groups/${g.id}`} onClick={open(g.id)} className="flex h-full flex-col gap-1 rounded-lg border bg-card p-3 hover:bg-accent">
                  <span className="truncate font-medium" title={g.name}>{g.name}</span>
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{when(g.last_used_at)}</span>
                    <span className="shrink-0">{t("{n} students", { n: g.students.length })}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rows.length > 0 && (<>
        <h2 className="pt-2 text-sm font-semibold">{t("All groups")}</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" aria-label={t("Search groups")} placeholder={t("Search by group or student name")}
                   className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant="outline" className="lg:hidden" aria-expanded={showFilters} aria-controls="group-filters"
                  onClick={() => setShowFilters(!showFilters)}>
            <Filter /> {t("Filters")}{nFilters ? ` · ${nFilters}` : ""}
          </Button>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-xs text-muted-foreground" aria-live="polite">{t("{n} of {total} groups", { n: shown.length, total: rows.length })}</p>
            {shown.length === 0 && <p className="text-sm text-muted-foreground">{t("No group matches the search and filters.")}</p>}
            {shown.length > 0 && <Card className="divide-y gap-0 overflow-hidden py-0">
              {shown.map((g) => (
                <div key={g.id} className="flex items-center hover:bg-accent">
                  <a href={`/groups/${g.id}`} onClick={open(g.id)}
                     className={cn("flex min-w-0 flex-1 items-center justify-between gap-3 py-3 pl-4", g.archived && "text-muted-foreground")}>
                    <span className="min-w-0 truncate font-medium">{g.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <span>{t("{n} students", { n: g.students.length })}</span>
                      <span className="hidden sm:inline">{when(g.last_used_at)}</span>
                      {g.archived && <Badge variant="secondary">{t("Archived")}</Badge>}
                    </span>
                  </a>
                  <Button variant="ghost" size="icon" className="mx-2 size-8 shrink-0 text-muted-foreground" disabled={arch.busy}
                          aria-label={t(g.archived ? "Unarchive {title}" : "Archive {title}", { title: g.name })}
                          title={t(g.archived ? "Unarchive" : "Archive")} onClick={() => archive(g)}>
                    {g.archived ? <ArchiveRestore /> : <Archive />}
                  </Button>
                </div>
              ))}
            </Card>}
          </div>
          <aside id="group-filters" aria-label={t("Filters")}
                 className={cn("order-first space-y-4 rounded-lg border p-4 lg:order-last lg:sticky lg:top-17 lg:block lg:w-60 lg:shrink-0", !showFilters && "hidden")}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("Filters")}</h2>
              <Button size="sm" variant="ghost" className="h-7" disabled={!nFilters}
                      onClick={() => { setStates(["active"]); setCreated(ALL_TIME); }}>{t("Clear")}</Button>
            </div>
            <div className="space-y-2">
              <p id="group-sort" className="text-xs font-medium text-muted-foreground">{t("Sort by")}</p>
              <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <SelectTrigger size="sm" className="w-full" aria-labelledby="group-sort"><SelectValue /></SelectTrigger>
                <SelectContent position="popper">{SORTS.map(([id, label]) => <SelectItem key={id} value={id}>{t(label)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-medium text-muted-foreground">{t("Status")}</legend>
              {([["active", t("Active")], ["archived", t("Archived")]] as const).map(([s, label]) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={states.includes(s)}
                            onCheckedChange={() => setStates(states.includes(s) ? states.filter((x) => x !== s) : [...states, s])} />
                  {label} <span className="text-xs text-muted-foreground">{rows.filter((g) => stateOf(g) === s).length}</span>
                </label>
              ))}
            </fieldset>
            <DateFilter title={t("Created")} value={created} onChange={setCreated} />
          </aside>
        </div>
      </>)}
    </Page>
  );
}
