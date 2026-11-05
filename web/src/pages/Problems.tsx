import { useState } from "react";
import { Filter, Loader2, Search, X } from "lucide-react";
import { ErrorText, Page, useAction, useLoad, when } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import TagInput from "@/components/TagInput";
import { Label } from "@/components/ui/label";
import { api, type Problem } from "@/lib/api";
import { t } from "@/lib/i18n";
import { usePreparing } from "@/lib/preparing";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

type Status = "draft" | "ready";
type Sort = "updated-desc" | "updated-asc" | "name-asc" | "name-desc";
const SORTS: [Sort, string][] = [
  ["updated-desc", "Recently changed"], ["updated-asc", "Least recently changed"], ["name-asc", "Name A–Z"], ["name-desc", "Name Z–A"],
];
type Row = { id: string; title: string; status: Status; rubric_version: number; tags: string[]; updated_at: string };
const lower = (s: string) => s.toLocaleLowerCase();

/** PL-15: a title is enough to save a problem; it starts as a draft. */
export default function Problems() {
  const preparing = usePreparing();
  // a finished preparation can change a row (a regenerated ready problem is a draft again)
  const list = useLoad(() => api.get<Row[]>("/api/problems"), [preparing]);
  const stored = useLoad(() => api.get<string[]>("/api/problems/tags"), []);  // PL-41: used or not
  const [title, setTitle] = useState("");
  const act = useAction();
  // PL-42: search and filters run on the loaded list
  const [q, setQ] = useState("");
  const [statuses, setStatuses] = useState<Status[]>([]);  // none checked: both
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("updated-desc");
  const [showFilters, setShowFilters] = useState(false);  // phones only; always shown on wide screens
  const rows = list.data ?? [];
  const allTags = stored.data ?? [];
  const words = lower(q).split(/\s+/).filter(Boolean);
  const shown = rows.filter((r) =>
    words.every((w) => lower(r.title).includes(w) || r.tags.some((x) => lower(x).includes(w)))
    && (!statuses.length || statuses.includes(r.status))
    && tags.every((x) => r.tags.some((y) => lower(y) === lower(x))))
    .sort((a, b) => sort.startsWith("name") ? a.title.localeCompare(b.title) * (sort === "name-asc" ? 1 : -1)
      : (a.updated_at < b.updated_at ? -1 : 1) * (sort === "updated-asc" ? 1 : -1));
  const nFilters = statuses.length + tags.length;

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
      <ErrorText>{list.error}</ErrorText>
      {list.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("No problems yet. Use New problem to start one.")}</p>}
      {rows.length > 0 && (<>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" aria-label={t("Search problems")} placeholder={t("Search by name or tag")}
                   className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Button variant="outline" className="lg:hidden" aria-expanded={showFilters} aria-controls="problem-filters"
                  onClick={() => setShowFilters(!showFilters)}>
            <Filter /> {t("Filters")}{nFilters ? ` · ${nFilters}` : ""}
          </Button>
        </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">{t("{n} of {total} problems", { n: shown.length, total: rows.length })}</p>
        {shown.length === 0 && <p className="text-sm text-muted-foreground">{t("No problem matches the search and filters.")}</p>}
      {shown.length > 0 && <Card className="divide-y gap-0 overflow-hidden py-0">
        {shown.map((p) => (
          <a key={p.id} href={`/problems/${p.id}`} onClick={(e) => { e.preventDefault(); navigate(`/problems/${p.id}`); }}
             className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 truncate font-medium">{p.title}</span>
              {preparing.has(p.id) && (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" role="status" aria-label={t("Preparing the AI grader")} />
              )}
              {p.tags.map((x) => <Badge key={x} variant="secondary" className="font-normal">{x}</Badge>)}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">{when(p.updated_at)}</span>
              {p.status === "ready" ? <Badge>{t("Ready · v{n}", { n: p.rubric_version })}</Badge> : <Badge variant="outline">{t("Draft")}</Badge>}
            </span>
          </a>
        ))}
      </Card>}
      </div>
      <aside id="problem-filters" aria-label={t("Filters")}
             className={cn("order-first space-y-4 rounded-lg border p-4 lg:order-last lg:sticky lg:top-17 lg:block lg:w-60 lg:shrink-0", !showFilters && "hidden")}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("Filters")}</h2>
          <Button size="sm" variant="ghost" className="h-7" disabled={!nFilters}
                  onClick={() => { setStatuses([]); setTags([]); }}>{t("Clear")}</Button>
        </div>
        <div className="space-y-2">
          <p id="sort-label" className="text-xs font-medium text-muted-foreground">{t("Sort by")}</p>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger size="sm" className="w-full" aria-labelledby="sort-label"><SelectValue /></SelectTrigger>
            <SelectContent position="popper">
              {SORTS.map(([id, label]) => <SelectItem key={id} value={id}>{t(label)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium text-muted-foreground">{t("Status")}</legend>
          {([["draft", t("Draft")], ["ready", t("Ready")]] as const).map(([s, label]) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <Checkbox checked={statuses.includes(s)}
                        onCheckedChange={() => setStatuses(statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s])} />
              {label} <span className="text-xs text-muted-foreground">{rows.filter((r) => r.status === s).length}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-2 text-xs font-medium text-muted-foreground">
            {t("Tags (all selected)")}{tags.length ? ` · ${tags.length}` : ""}
          </legend>
          {allTags.length === 0 && <p className="text-xs text-muted-foreground">{t("No tags yet. Add them with the plus on a problem.")}</p>}
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {tags.map((x) => (
                <li key={x}>
                  <Badge variant="secondary" className="max-w-full gap-0.5 pr-0.5">
                    <span className="truncate" title={x}>{x}</span>
                    <button type="button" aria-label={t("Remove tag {tag}", { tag: x })}
                            className="rounded-full p-0.5 hover:bg-background/60" onClick={() => setTags(tags.filter((y) => y !== x))}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {allTags.length > 0 && (
            // PL-42: tags are picked from suggestions, so the panel never lists them all
            <TagInput label={t("Filter by tag")} placeholder={t("Type a tag…")}
                      suggestions={allTags.filter((x) => !tags.includes(x)).map((x) => ({
                        value: x, hint: String(rows.filter((r) => r.tags.some((y) => lower(y) === lower(x))).length),
                      }))}
                      onPick={(x) => setTags([...tags, x])} />
          )}
        </fieldset>
      </aside>
      </div>
      </>)}
    </Page>
  );
}
