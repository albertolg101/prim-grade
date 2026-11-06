import { useEffect, useState } from "react";
import Capture from "@/components/Capture";
import { ErrorText, StateBadge, pts, useAction, useLoad, when } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TagInput from "@/components/TagInput";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { api, pagesForm, type AnswerRow, type Group, type Page } from "@/lib/api";
import { t } from "@/lib/i18n";
import { navigate } from "@/lib/router";

type Sort = "newest" | "oldest" | "name";
const SORTS: [Sort, string][] = [["newest", "Newest first"], ["oldest", "Oldest first"], ["name", "Name A–Z"]];
const nameOf = (r: AnswerRow) => r.student_name || r.label || "";

/** PL-20, PL-21, PL-45 for one problem: add answers, grade the selected ones, open one to review. */
export default function Answers({ problemId, ready }: { problemId: string; ready: boolean }) {
  const rows = useLoad(() => api.get<AnswerRow[]>(`/api/problems/${problemId}/answers`), [problemId]);
  const [pages, setPages] = useState<Page[]>([]);
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [group, setGroup] = useState<Group | null>(null);  // PL-46: optional
  const groups = useLoad(() => api.get<Group[]>("/api/groups"), []);
  const groupName = (id: string | null) => groups.data?.find((g) => g.id === id)?.name;
  const [sort, setSort] = useState<Sort>("newest");  // the server lists newest first
  const act = useAction();
  const shown = [...(rows.data ?? [])];
  if (sort === "oldest") shown.reverse();
  if (sort === "name") shown.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
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
      {!!rows.data?.length && (
        <div className="flex items-center gap-2">
          <span id="answer-sort" className="text-xs font-medium text-muted-foreground">{t("Sort by")}</span>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger size="sm" className="w-44" aria-labelledby="answer-sort"><SelectValue /></SelectTrigger>
            <SelectContent position="popper">{SORTS.map(([id, label]) => <SelectItem key={id} value={id}>{t(label)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {rows.data && <AnswerTable rows={shown} reload={rows.reload} ctx={`problem:${problemId}`} canGrade={ready} groupName={groupName} />}
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

  const gradable = rows.filter((r) => r.selected && r.state !== "running" && r.state !== "approved");
  const toggle = (id: string) => { const s = new Set(picked); if (s.has(id)) s.delete(id); else s.add(id); setPicked(s); };
  const grade = (ids: string[]) => act.run(async () => { await api.post("/api/answers/grade", { answer_ids: ids }); setPicked(new Set()); await reload(); });
  const done = rows.filter((r) => r.state !== "running" && r.state !== "not_graded").length;

  if (!rows.length) return <p className="text-sm text-muted-foreground">{t("No answers yet.")}</p>;
  return (
    <div className="space-y-2">
      {canGrade && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!picked.size || act.busy} onClick={() => grade([...picked])}>{t("Grade selected ({n})", { n: picked.size })}</Button>
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
