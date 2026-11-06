import { useEffect, useState } from "react";
import AddAnswers from "@/components/AddAnswers";
import DateRange from "@/components/DateRange";
import { ErrorText, StateBadge, pts, useAction, useLoad, when } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TagInput from "@/components/TagInput";
import { cn } from "@/lib/utils";
import { Filter, X } from "lucide-react";
import { api, type AnswerRow, type Exam, type Group } from "@/lib/api";
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
type Option = { key: string; name: string };
const nameIn = (options: Option[], key: string) => options.find((o) => o.key === key)?.name ?? "…";
// PL-49: three status boxes over the six answer states; drafts and failures need the teacher too
type Status = "review" | "approved" | "not_graded";
const STATUSES: [Status, string][] = [["review", "Review required"], ["approved", "Approved"], ["not_graded", "Not graded"]];
const statusOf = (r: AnswerRow): Status => r.state === "approved" ? "approved" : r.state === "not_graded" || r.state === "running" ? "not_graded" : "review";

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
  const [group, setGroup] = useState<Group | null>(null);  // PL-46: optional
  const groups = useLoad(() => api.get<Group[]>("/api/groups"), []);
  const groupName = (id: string | null) => groups.data?.find((g) => g.id === id)?.name;
  const exams = useLoad(() => api.get<Exam[]>("/api/exams"), []);
  const [sort, setSort] = useState<Sort>("newest");  // the server lists newest first
  // PL-49: filters run on the loaded list and are not saved; an empty facet means every value
  const [picked, setPicked] = useState(NO_FILTER);
  const [statuses, setStatuses] = useState<Status[]>(STATUSES.map(([s]) => s));  // all checked; none checked shows nothing
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);  // phones only; always shown on wide screens
  const all = rows.data ?? [];
  const [lo, hi] = bounds(range, from, to);
  const shown = all.filter((r) => {
    const at = new Date(r.created_at);
    return statuses.includes(statusOf(r)) && (!lo || at >= lo) && (!hi || at < hi)
      && (["group", "exam", "label"] as Facet[]).every((f) => !picked[f].length || picked[f].includes(keyOf(r, f)));
  });
  if (sort === "oldest") shown.reverse();
  if (sort === "name") shown.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  // PL-49: each autocomplete opens on the newest: groups and exams by creation, labels by their latest answer
  const facets: { f: Facet; title: string; options: Option[]; empty: string; field: string; typeHint: string; noMatch: string; remove: (name: string) => string }[] = [
    { f: "group", title: t("Group"), empty: t("No groups yet"), field: t("Filter by group"), typeHint: t("Type a group…"), noMatch: "No group matches “{q}”.",
      remove: (name) => t("Remove group {name}", { name }),
      options: [...(groups.data ?? [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).map((g) => ({ key: g.id, name: g.name })) },
    { f: "exam", title: t("Exam"), empty: t("No exams yet"), field: t("Filter by exam"), typeHint: t("Type an exam…"), noMatch: "No exam matches “{q}”.",
      remove: (name) => t("Remove exam {name}", { name }),
      options: (exams.data ?? []).map((e) => ({ key: e.id, name: e.title })) },  // the server lists the newest first
    { f: "label", title: t("Label"), empty: t("No labels yet"), field: t("Filter by label"), typeHint: t("Type a label…"), noMatch: "No label matches “{q}”.",
      remove: (label) => t("Remove label {label}", { label }),
      options: [...new Set(all.map((r) => r.label).filter(Boolean))].map((x) => ({ key: x, name: x })) },  // rows come newest first
  ];
  const nFilters = picked.group.length + picked.exam.length + picked.label.length + (range === "all" ? 0 : 1) + (statuses.length === STATUSES.length ? 0 : 1);

  return (
    <div className="space-y-4">
      <ErrorText>{rows.error}</ErrorText>
      {/* PL-50: one toolbar; adding answers opens a dialog */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {rows.data?.length === 0 ? t("No answers yet.") : all.length > 0 && t("{n} of {total} answers", { n: shown.length, total: all.length })}
        </p>
        <div className="flex gap-2">
          {all.length > 0 && (
            <Button size="sm" variant="outline" className="lg:hidden" aria-expanded={showFilters} aria-controls="answer-filters"
                    onClick={() => setShowFilters(!showFilters)}>
              <Filter /> {t("Filters")}{nFilters ? ` · ${nFilters}` : ""}
            </Button>
          )}
          {ready && <AddAnswers problemId={problemId} groups={groups.data ?? []} group={group} onGroup={setGroup} onAdded={rows.reload} />}
        </div>
      </div>
      {all.length > 0 && (<>
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
                      onClick={() => { setPicked(NO_FILTER); setStatuses(STATUSES.map(([s]) => s)); setRange("all"); setFrom(""); setTo(""); }}>{t("Clear")}</Button>
            </div>
            <div className="space-y-2">
              <p id="answer-sort" className="text-xs font-medium text-muted-foreground">{t("Sort by")}</p>
              <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <SelectTrigger size="sm" className="w-full" aria-labelledby="answer-sort"><SelectValue /></SelectTrigger>
                <SelectContent position="popper">{SORTS.map(([id, label]) => <SelectItem key={id} value={id}>{t(label)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-medium text-muted-foreground">{t("Status")}</legend>
              {STATUSES.map(([st, label]) => (
                <label key={st} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={statuses.includes(st)}
                            onCheckedChange={() => setStatuses(statuses.includes(st) ? statuses.filter((x) => x !== st) : [...statuses, st])} />
                  {t(label)} <span className="text-xs text-muted-foreground">{all.filter((r) => statusOf(r) === st).length}</span>
                </label>
              ))}
            </fieldset>
            <div className="space-y-2">
              <p id="answer-date" className="text-xs font-medium text-muted-foreground">{t("Uploaded")}</p>
              <Select value={range} onValueChange={(v) => setRange(v as Range)}>
                <SelectTrigger size="sm" className="w-full" aria-labelledby="answer-date"><SelectValue /></SelectTrigger>
                <SelectContent position="popper">{RANGES.map(([id, label]) => <SelectItem key={id} value={id}>{t(label)}</SelectItem>)}</SelectContent>
              </Select>
              {range === "custom" && <DateRange from={from} to={to} onChange={(f, t2) => { setFrom(f); setTo(t2); }} />}
            </div>
            {/* like the problem tags (PL-42): picked from an autocomplete that opens on the newest first */}
            {facets.map(({ f, title, options, empty, field, typeHint, noMatch, remove }) => (
              <fieldset key={f} className="min-w-0 space-y-2">
                <legend className="mb-2 text-xs font-medium text-muted-foreground">{title}{picked[f].length ? ` · ${picked[f].length}` : ""}</legend>
                {picked[f].length > 0 && (
                  <ul className="flex flex-wrap gap-1">
                    {picked[f].map((k) => (
                      <li key={k} className="max-w-full">
                        <Badge variant="secondary" className="max-w-full gap-0.5 pr-0.5">
                          <span className="truncate" title={nameIn(options, k)}>{nameIn(options, k)}</span>
                          <button type="button" aria-label={remove(nameIn(options, k))} className="rounded-full p-0.5 hover:bg-background/60"
                                  onClick={() => setPicked({ ...picked, [f]: picked[f].filter((y) => y !== k) })}>
                            <X className="size-3" />
                          </button>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                {options.length ? (
                  <TagInput label={field} placeholder={typeHint} noMatch={noMatch}
                            suggestions={options.filter((o) => !picked[f].includes(o.key)).map((o) => ({ value: o.name, hint: String(all.filter((r) => keyOf(r, f) === o.key).length) }))}
                            // ponytail: two groups or exams with one name pick the newest; show more detail if teachers reuse names
                            onPick={(name) => { const o = options.find((x) => x.name === name); if (o) setPicked({ ...picked, [f]: [...picked[f], o.key] }); }} />
                ) : <p className="text-xs text-muted-foreground">{empty}</p>}
              </fieldset>
            ))}
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
