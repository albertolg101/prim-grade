import { useEffect, useState } from "react";
import Capture from "@/components/Capture";
import { ErrorText, StateBadge, pts, useAction, useLoad, when } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TagInput from "@/components/TagInput";
import { cn } from "@/lib/utils";
import { Filter, X } from "lucide-react";
import { api, pagesForm, type AnswerRow, type Exam, type Group, type Page } from "@/lib/api";
import { t } from "@/lib/i18n";
import { navigate } from "@/lib/router";

type Sort = "newest" | "oldest" | "name";
const SORTS: [Sort, string][] = [["newest", "Newest first"], ["oldest", "Oldest first"], ["name", "Name A–Z"]];
const nameOf = (r: AnswerRow) => r.student_name || r.label || "";
// PL-49: date ranges in the style of analytics tools; days are local calendar days
type Range = "all" | "today" | "yesterday" | "7d" | "30d" | "month" | "year" | "custom";
const RANGES: [Range, string][] = [
  ["all", "All time"], ["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"],
  ["month", "This month"], ["year", "This year"], ["custom", "Custom range"],
];
type Facet = "group" | "exam" | "label";
const keyOf = (r: AnswerRow, f: Facet) => (f === "group" ? r.group_id : f === "exam" ? r.exam_id : r.label) || "";
const NO_FILTER: Record<Facet, string[]> = { group: [], exam: [], label: [] };

/** [from, to) of a range; null is no bound. A custom range includes both of its days. */
function bounds(r: Range, from: string, to: string, now = new Date()): [Date | null, Date | null] {
  const day = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
  const next = (iso: string) => { const d = new Date(`${iso}T00:00`); d.setDate(d.getDate() + 1); return d; };
  switch (r) {
    case "today": return [day(0), null];
    case "yesterday": return [day(-1), day(0)];
    case "7d": return [day(-6), null];
    case "30d": return [day(-29), null];
    case "month": return [new Date(now.getFullYear(), now.getMonth(), 1), null];
    case "year": return [new Date(now.getFullYear(), 0, 1), null];
    case "custom": return [from ? new Date(`${from}T00:00`) : null, to ? next(to) : null];
    default: return [null, null];
  }
}

/** PL-20, PL-21, PL-45 for one problem: add answers, grade the selected ones, open one to review. */
export default function Answers({ problemId, ready }: { problemId: string; ready: boolean }) {
  const rows = useLoad(() => api.get<AnswerRow[]>(`/api/problems/${problemId}/answers`), [problemId]);
  const [pages, setPages] = useState<Page[]>([]);
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [group, setGroup] = useState<Group | null>(null);  // PL-46: optional
  const groups = useLoad(() => api.get<Group[]>("/api/groups"), []);
  const groupName = (id: string | null) => groups.data?.find((g) => g.id === id)?.name;
  const exams = useLoad(() => api.get<Exam[]>("/api/exams"), []);
  const [sort, setSort] = useState<Sort>("newest");  // the server lists newest first
  // PL-49: filters run on the loaded list and are not saved; an empty facet means every value
  const [picked, setPicked] = useState(NO_FILTER);
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);  // phones only; always shown on wide screens
  const act = useAction();
  const all = rows.data ?? [];
  const [lo, hi] = bounds(range, from, to);
  const shown = all.filter((r) => {
    const at = new Date(r.created_at);
    return (!lo || at >= lo) && (!hi || at < hi)
      && (["group", "exam", "label"] as Facet[]).every((f) => !picked[f].length || picked[f].includes(keyOf(r, f)));
  });
  if (sort === "oldest") shown.reverse();
  if (sort === "name") shown.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const labels = [...new Set(all.map((r) => r.label).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const nFilters = picked.group.length + picked.exam.length + picked.label.length + (range === "all" ? 0 : 1);
  const facetName = (f: Facet, k: string) => !k ? t(f === "group" ? "No group" : "No exam")
    : f === "group" ? groupName(k) ?? "…" : exams.data?.find((e) => e.id === k)?.title ?? "…";
  const add = () => act.run(async () => {
    await api.form(`/api/problems/${problemId}/answers`,
      pagesForm(pages, { label, student_name: name, group_id: group?.id }));
    setPages([]); setLabel(""); setName("");  // the group stays: the next answer is often from the same one
    await rows.reload();
  });

  return (
    <div className="space-y-4">
      {ready && (
        <div className="space-y-2 rounded-lg border p-3">
          <h3 className="text-sm font-semibold">{t("Add an answer")}</h3>
          <Capture pages={pages} onChange={setPages} label={t("answer pages")} />
          <div className="flex flex-wrap gap-2">
            <Input className="w-full sm:w-72" placeholder={t("Student name (optional)")} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("Student name")} />
            <Input className="w-full sm:w-52" placeholder={t("Label (optional)")} value={label} onChange={(e) => setLabel(e.target.value)} aria-label={t("Label")} />
            <GroupPick groups={(groups.data ?? []).filter((g) => !g.archived)} value={group} onChange={setGroup} />
            <Button disabled={!pages.length || act.busy} onClick={add}>{pages.length === 1 ? t("Add answer (1 page)") : t("Add answer ({n} pages)", { n: pages.length })}</Button>
          </div>
          <ErrorText>{act.error}</ErrorText>
        </div>
      )}
      <ErrorText>{rows.error}</ErrorText>
      {rows.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("No answers yet.")}</p>}
      {all.length > 0 && (<>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground" aria-live="polite">{t("{n} of {total} answers", { n: shown.length, total: all.length })}</p>
          <Button size="sm" variant="outline" className="lg:hidden" aria-expanded={showFilters} aria-controls="answer-filters"
                  onClick={() => setShowFilters(!showFilters)}>
            <Filter /> {t("Filters")}{nFilters ? ` · ${nFilters}` : ""}
          </Button>
        </div>
        {/* PL-49: the panel starts level with the list, on its right */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            {shown.length ? <AnswerTable rows={shown} reload={rows.reload} ctx={`problem:${problemId}`} canGrade={ready} groupName={groupName} />
              : <p className="text-sm text-muted-foreground">{t("No answer matches the filters.")}</p>}
          </div>
          <aside id="answer-filters" aria-label={t("Filters")}
                 className={cn("order-first space-y-4 rounded-lg border p-4 lg:order-last lg:sticky lg:top-17 lg:block lg:w-60 lg:shrink-0", !showFilters && "hidden")}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("Filters")}</h2>
              <Button size="sm" variant="ghost" className="h-7" disabled={!nFilters}
                      onClick={() => { setPicked(NO_FILTER); setRange("all"); setFrom(""); setTo(""); }}>{t("Clear")}</Button>
            </div>
            <div className="space-y-2">
              <p id="answer-sort" className="text-xs font-medium text-muted-foreground">{t("Sort by")}</p>
              <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <SelectTrigger size="sm" className="w-full" aria-labelledby="answer-sort"><SelectValue /></SelectTrigger>
                <SelectContent position="popper">{SORTS.map(([id, label]) => <SelectItem key={id} value={id}>{t(label)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p id="answer-date" className="text-xs font-medium text-muted-foreground">{t("Uploaded")}</p>
              <Select value={range} onValueChange={(v) => setRange(v as Range)}>
                <SelectTrigger size="sm" className="w-full" aria-labelledby="answer-date"><SelectValue /></SelectTrigger>
                <SelectContent position="popper">{RANGES.map(([id, label]) => <SelectItem key={id} value={id}>{t(label)}</SelectItem>)}</SelectContent>
              </Select>
              {range === "custom" && (
                <div className="space-y-2">
                  <label className="block space-y-1 text-xs text-muted-foreground">{t("From")}
                    <Input type="date" className="h-8 px-2 text-xs" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                  </label>
                  <label className="block space-y-1 text-xs text-muted-foreground">{t("To")}
                    <Input type="date" className="h-8 px-2 text-xs" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                  </label>
                </div>
              )}
            </div>
            {([["group", "Group"], ["exam", "Exam"]] as [Facet, string][]).map(([f, title]) => {
              const keys = [...new Set(all.map((r) => keyOf(r, f)))]
                .sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || facetName(f, a).localeCompare(facetName(f, b)));
              if (keys.length < 2 && !picked[f].length) return null;  // one value: nothing to filter
              return (
                <fieldset key={f} className="min-w-0 space-y-2">
                  <legend className="mb-2 text-xs font-medium text-muted-foreground">{t(title)}</legend>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {keys.map((k) => (
                      <label key={k} className="flex min-w-0 items-center gap-2 text-sm">
                        <Checkbox checked={picked[f].includes(k)}
                                  onCheckedChange={() => setPicked({ ...picked, [f]: picked[f].includes(k) ? picked[f].filter((x) => x !== k) : [...picked[f], k] })} />
                        <span className={cn("truncate", !k && "text-muted-foreground")} title={facetName(f, k)}>{facetName(f, k)}</span>
                        <span className="text-xs text-muted-foreground">{all.filter((r) => keyOf(r, f) === k).length}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
            {labels.length > 0 && (
              // like the problem tags (PL-42): picked from an autocomplete, so the panel never lists them all
              <fieldset className="min-w-0 space-y-2">
                <legend className="mb-2 text-xs font-medium text-muted-foreground">{t("Label")}{picked.label.length ? ` · ${picked.label.length}` : ""}</legend>
                {picked.label.length > 0 && (
                  <ul className="flex flex-wrap gap-1">
                    {picked.label.map((x) => (
                      <li key={x}>
                        <Badge variant="secondary" className="max-w-full gap-0.5 pr-0.5">
                          <span className="truncate" title={x}>{x}</span>
                          <button type="button" aria-label={t("Remove label {label}", { label: x })} className="rounded-full p-0.5 hover:bg-background/60"
                                  onClick={() => setPicked({ ...picked, label: picked.label.filter((y) => y !== x) })}>
                            <X className="size-3" />
                          </button>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <TagInput label={t("Filter by label")} placeholder={t("Type a label…")} noMatch="No label matches “{q}”."
                          suggestions={labels.filter((x) => !picked.label.includes(x)).map((x) => ({ value: x, hint: String(all.filter((r) => r.label === x).length) }))}
                          onPick={(x) => setPicked({ ...picked, label: [...picked.label, x] })} />
              </fieldset>
            )}
          </aside>
        </div>
      </>)}
    </div>
  );
}

/** Answers with their state; select some and grade them. Polls while any is running. */
export function AnswerTable({ rows, reload, ctx, canGrade, problemTitle, groupName }: {
  rows: AnswerRow[]; reload: () => Promise<unknown>; ctx: string; canGrade: boolean; problemTitle?: (id: string) => string;
  groupName?: (id: string | null) => string | undefined;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const act = useAction();
  const running = rows.some((r) => r.state === "running");
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(reload, 2000);
    return () => clearInterval(timer);
  }, [running, reload]);

  const chosen = [...picked].filter((id) => rows.some((r) => r.id === id));  // PL-49: hidden by a filter, not graded
  const gradable = rows.filter((r) => r.selected && r.state !== "running" && r.state !== "approved");
  const toggle = (id: string) => { const s = new Set(picked); if (s.has(id)) s.delete(id); else s.add(id); setPicked(s); };
  const grade = (ids: string[]) => act.run(async () => { await api.post("/api/answers/grade", { answer_ids: ids }); setPicked(new Set()); await reload(); });
  const done = rows.filter((r) => r.state !== "running" && r.state !== "not_graded").length;

  if (!rows.length) return <p className="text-sm text-muted-foreground">{t("No answers yet.")}</p>;
  return (
    <div className="space-y-2">
      {canGrade && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!chosen.length || act.busy} onClick={() => grade(chosen)}>{t("Grade selected ({n})", { n: chosen.length })}</Button>
          <Button size="sm" variant="outline" disabled={act.busy || !gradable.some((r) => r.state === "not_graded")}
                  onClick={() => grade(gradable.filter((r) => r.state === "not_graded").map((r) => r.id))}>
            {t("Grade all not graded")}
          </Button>
          {running && <span className="text-sm text-muted-foreground" aria-live="polite">{t("Grading… {done} of {total} have a result", { done, total: rows.length })}</span>}
        </div>
      )}
      <ErrorText>{act.error}</ErrorText>
      <ul className="divide-y rounded-lg border">
        {rows.map((r) => (
          <li key={r.id} className={`flex items-center gap-3 px-3 py-2 ${r.selected ? "" : "opacity-60"}`}>
            {canGrade && <Checkbox aria-label={t("Select {name}", { name: r.student_name || r.label || t("answer") })} checked={picked.has(r.id)}
                                   disabled={r.state === "running"} onCheckedChange={() => toggle(r.id)} />}
            <a href={`/answers/${r.id}?ctx=${ctx}`} onClick={(e) => { e.preventDefault(); navigate(`/answers/${r.id}?ctx=${ctx}`); }}
               className="min-w-0 flex-1 hover:underline">
              <div className="truncate font-medium">
                {r.student_name || r.label || t("Unnamed answer")}
                {r.student_name && r.label && <span className="font-normal text-muted-foreground"> · {r.label}</span>}
                {problemTitle && <span className="font-normal text-muted-foreground"> · {problemTitle(r.problem_id)}</span>}
                {groupName?.(r.group_id) && <span className="font-normal text-muted-foreground"> · {groupName(r.group_id)}</span>}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {r.source === "student" ? t("Uploaded by the student") : t("Uploaded by you")} · {when(r.created_at)}
                {r.version > 1 || !r.selected ? ` · ${r.selected ? t("version {n} (graded)", { n: r.version }) : t("version {n}", { n: r.version })}` : ""}
              </div>
            </a>
            <span className="hidden text-sm tabular-nums sm:inline">
              {r.state === "approved" ? `${pts(r.approved_total)} / ${pts(r.max_points)}` : r.proposed_total != null ? t("AI: {points}", { points: `${pts(r.proposed_total)} / ${pts(r.max_points)}` }) : ""}
            </span>
            <StateBadge state={r.state} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** PL-46: an optional group, picked from the teacher's groups with an autocomplete; once picked it
 * shows as a chip that can be removed. */
function GroupPick({ groups, value, onChange }: { groups: Group[]; value: Group | null; onChange: (g: Group | null) => void }) {
  const box = "w-full sm:w-52";
  if (value) {
    return (
      <div className={cn("flex h-9 items-center justify-between gap-2 rounded-md border px-3 text-sm", box)}>
        <span className="min-w-0 truncate" title={value.name}>{value.name}</span>
        <button type="button" aria-label={t("Remove group {name}", { name: value.name })} className="rounded-full p-0.5 hover:bg-accent"
                onClick={() => onChange(null)}><X className="size-3.5" /></button>
      </div>
    );
  }
  if (!groups.length) return <Input className={box} disabled placeholder={t("No groups yet")} aria-label={t("Group")} />;
  return (
    <TagInput className={box} inputClassName="h-9" label={t("Group")} placeholder={t("Group (optional)")}
              noMatch="No group matches “{q}”." suggestions={groups.map((g) => ({ value: g.name }))}
              onPick={(name) => onChange(groups.find((g) => g.name === name) ?? null)} />
  );
}
