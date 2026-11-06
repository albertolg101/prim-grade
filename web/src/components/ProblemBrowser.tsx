import { useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { ALL_TIME, DateFilter, bounds } from "@/components/DateRange";
import TagInput from "@/components/TagInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/lib/i18n";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

type Status = "draft" | "ready";
type State = Status | "archived";  // PL-44: an archived problem keeps its status but shows only under Archived
const DEFAULT_STATES: State[] = ["draft", "ready"];
type Sort = "updated-desc" | "updated-asc" | "name-asc" | "name-desc";
const SORTS: [Sort, string][] = [
  ["updated-desc", "Recently changed"], ["updated-asc", "Least recently changed"], ["name-asc", "Name A–Z"], ["name-desc", "Name Z–A"],
];
export type ProblemRow = { id: string; title: string; status: string; archived: boolean; rubric_version: number; tags: string[]; updated_at: string };
const lower = (s: string) => s.toLocaleLowerCase();
const stateOf = (r: ProblemRow): State => r.archived ? "archived" : r.status as Status;

/** PL-42 (and PL-51 on a group's page): a search bar, the problems, and a filter panel on their right.
 * The caller draws what sits inside each row after the title (`meta`) and the buttons after it (`actions`). */
export default function ProblemBrowser<R extends ProblemRow>({ rows, allTags, meta, actions, afterTitle, query = "" }: {
  query?: string;  // PL-51: added to each problem link, e.g. the group to filter its answers by
  rows: R[]; allTags: string[]; meta: (r: R) => React.ReactNode; actions?: (r: R) => React.ReactNode; afterTitle?: (r: R) => React.ReactNode;
}) {
  // search and filters run on the loaded list and are not saved
  const [q, setQ] = useState("");
  const [states, setStates] = useState<State[]>(DEFAULT_STATES);  // none checked: nothing shown
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("updated-desc");
  const [changed, setChanged] = useState(ALL_TIME);  // by updated_at, the date the list shows
  const [showFilters, setShowFilters] = useState(false);  // phones only; always shown on wide screens
  const words = lower(q).split(/\s+/).filter(Boolean);
  const [lo, hi] = bounds(changed);
  const shown = rows.filter((r) =>
    (!lo || new Date(r.updated_at) >= lo) && (!hi || new Date(r.updated_at) < hi) &&
    words.every((w) => lower(r.title).includes(w) || r.tags.some((x) => lower(x).includes(w)))
    && states.includes(stateOf(r))
    && tags.every((x) => r.tags.some((y) => lower(y) === lower(x))))
    .sort((a, b) => sort.startsWith("name") ? a.title.localeCompare(b.title) * (sort === "name-asc" ? 1 : -1)
      : (a.updated_at < b.updated_at ? -1 : 1) * (sort === "updated-asc" ? 1 : -1));
  const statesChanged = states.length !== DEFAULT_STATES.length || !DEFAULT_STATES.every((x) => states.includes(x));
  const nFilters = (statesChanged ? 1 : 0) + tags.length + (changed.range === "all" ? 0 : 1);

  return (<>
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
            // the row's buttons sit next to the link, never inside it
            <div key={p.id} className="flex items-center hover:bg-accent">
              <a href={`/problems/${p.id}${query}`} onClick={(e) => { e.preventDefault(); navigate(`/problems/${p.id}${query}`); }}
                 className={cn("flex min-w-0 flex-1 items-center justify-between gap-3 py-3 pl-4", !actions && "pr-4", p.archived && "text-muted-foreground")}>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 truncate font-medium">{p.title}</span>
                  {afterTitle?.(p)}
                  {p.tags.map((x) => <Badge key={x} variant="secondary" className="font-normal">{x}</Badge>)}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {meta(p)}
                  {p.archived && <Badge variant="secondary">{t("Archived")}</Badge>}
                  {p.status === "ready" ? <Badge>{t("Ready · v{n}", { n: p.rubric_version })}</Badge> : <Badge variant="outline">{t("Draft")}</Badge>}
                </span>
              </a>
              {actions && <div className="flex shrink-0 items-center gap-1 px-2">{actions(p)}</div>}
            </div>
          ))}
        </Card>}
      </div>
      <aside id="problem-filters" aria-label={t("Filters")}
             className={cn("order-first space-y-4 rounded-lg border p-4 lg:order-last lg:sticky lg:top-17 lg:block lg:w-60 lg:shrink-0", !showFilters && "hidden")}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("Filters")}</h2>
          <Button size="sm" variant="ghost" className="h-7" disabled={!nFilters}
                  onClick={() => { setStates(DEFAULT_STATES); setTags([]); setChanged(ALL_TIME); }}>{t("Clear")}</Button>
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
          {([["draft", t("Draft")], ["ready", t("Ready")], ["archived", t("Archived")]] as const).map(([s, label]) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <Checkbox checked={states.includes(s)}
                        onCheckedChange={() => setStates(states.includes(s) ? states.filter((x) => x !== s) : [...states, s])} />
              {label} <span className="text-xs text-muted-foreground">{rows.filter((r) => stateOf(r) === s).length}</span>
            </label>
          ))}
        </fieldset>
        <DateFilter title={t("Changed")} value={changed} onChange={setChanged} />
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
  </>);
}
