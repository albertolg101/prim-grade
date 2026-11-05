import { useEffect, useState } from "react";
import Capture from "@/components/Capture";
import { ErrorText, StateBadge, pts, useAction, useLoad, when } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api, pagesForm, type AnswerRow, type Page } from "@/lib/api";
import { t } from "@/lib/i18n";
import { navigate } from "@/lib/router";

/** PL-20, PL-21 for one problem: add answers, grade the selected ones, open one to review. */
export default function Answers({ problemId, ready }: { problemId: string; ready: boolean }) {
  const rows = useLoad(() => api.get<AnswerRow[]>(`/api/problems/${problemId}/answers`), [problemId]);
  const [pages, setPages] = useState<Page[]>([]);
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const act = useAction();
  const add = () => act.run(async () => {
    await api.form(`/api/problems/${problemId}/answers`, pagesForm(pages, { label, student_name: name }));
    setPages([]); setLabel(""); setName("");
    await rows.reload();
  });

  return (
    <div className="space-y-4">
      {ready && (
        <div className="space-y-2 rounded-lg border p-3">
          <h3 className="text-sm font-semibold">{t("Add an answer")}</h3>
          <Capture pages={pages} onChange={setPages} label={t("answer pages")} />
          <div className="flex flex-wrap gap-2">
            <Input className="w-full sm:w-48" placeholder={t("Student name (optional)")} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("Student name")} />
            <Input className="w-full sm:w-40" placeholder={t("Label (optional)")} value={label} onChange={(e) => setLabel(e.target.value)} aria-label={t("Label")} />
            <Button disabled={!pages.length || act.busy} onClick={add}>{pages.length === 1 ? t("Add answer (1 page)") : t("Add answer ({n} pages)", { n: pages.length })}</Button>
          </div>
          <ErrorText>{act.error}</ErrorText>
        </div>
      )}
      <ErrorText>{rows.error}</ErrorText>
      {rows.data && <AnswerTable rows={rows.data} reload={rows.reload} ctx={`problem:${problemId}`} canGrade={ready} />}
    </div>
  );
}

/** Answers with their state; select some and grade them. Polls while any is running. */
export function AnswerTable({ rows, reload, ctx, canGrade, problemTitle }: {
  rows: AnswerRow[]; reload: () => Promise<unknown>; ctx: string; canGrade: boolean; problemTitle?: (id: string) => string;
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
                {problemTitle && <span className="font-normal text-muted-foreground"> · {problemTitle(r.problem_id)}</span>}
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
