import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { GroupPick } from "@/components/AddAnswers";
import ImageViewer from "@/components/ImageViewer";
import { ErrorText, StateBadge, pts, useAction, useCrumbs, useLoad, when, type Crumb } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, type AnswerDetail, type AnswerRow, type CriterionScore, type Group, type RunOut } from "@/lib/api";
import { t } from "@/lib/i18n";
import { navigate, query } from "@/lib/router";

const REASONS = [
  ["misread_handwriting", "Misread the handwriting"],
  ["wrong_physics", "Wrong physics"],
  ["rubric_misapplied", "Applied the rubric wrongly"],
  ["other", "Other"],
] as const;

/** Where the review came from, for next / previous and the way back. */
function context(ctx: string | null) {
  const [kind, a, b] = (ctx ?? "").split(":");
  if (kind === "exam") return { kind, back: `/exams/${a}?group=${b}`, list: () => api.get<{ answers: AnswerRow[] }>(`/api/exams/${a}/groups/${b}/answers`).then((r) => r.answers) };
  if (kind === "problem") return { kind, back: `/problems/${a}?view=answers`, list: () => api.get<AnswerRow[]>(`/api/problems/${a}/answers`) };
  return null;
}

/** PL-22 to PL-24: one answer at a time; the stages stay apart (I5) and nothing is final until approved (I1). */
export default function Review({ id }: { id: string }) {
  const ctxParam = query("ctx");
  const ctx = context(ctxParam);
  const ans = useLoad(() => api.get<AnswerDetail>(`/api/answers/${id}`), [id]);
  const list = useLoad(() => (ctx ? ctx.list() : Promise.resolve([] as AnswerRow[])), [ctxParam]);
  const a = ans.data;
  const run = a?.runs[0];
  const act = useAction();

  useEffect(() => {
    if (a?.state !== "running") return;
    const timer = setInterval(ans.reload, 2000);
    return () => clearInterval(timer);
  }, [a?.state, ans.reload]);

  // PL-38
  const name = a ? a.student_name || a.label || t("Unnamed answer") : t("Answer");
  const crumbs: Crumb[] = ctx?.kind === "exam"
    ? [[t("Exams"), "/exams"], [t("Exam"), ctx.back], [name]]
    : [[t("Problems"), "/problems"], [a?.problem_title ?? t("Problem"), ctx?.back ?? (a ? `/problems/${a.problem_id}` : undefined)], [name]];
  useCrumbs(crumbs);

  const ids = (list.data ?? []).filter((r) => r.selected).map((r) => r.id);
  const at = ids.indexOf(id);
  const go = (j: number) => navigate(`/answers/${ids[j]}${ctxParam ? `?ctx=${ctxParam}` : ""}`);

  return (
    // on a computer the page fits the screen (no page scrollbar): the paper takes the height left and the
    // proposal column scrolls inside itself; on a phone the page scrolls as usual
    <div className="w-full space-y-3 px-4 py-4 sm:px-6 lg:flex lg:h-[calc(var(--app-h)-3.25rem)] lg:flex-col">
      {/* title and prev / next share one row; next / previous wraps under the title when it does not fit */}
      <div className="flex flex-wrap items-center gap-2">
        {a && (
          <>
            <h1 className="text-xl font-semibold">{name}</h1>
            <EditAnswer a={a} onSaved={ans.reload} />
            <StateBadge state={a.state} />
            <span className="text-sm text-muted-foreground">
              {a.problem_title} · {a.source === "student" ? t("uploaded by the student") : t("uploaded by you")} {when(a.created_at)} · {t("rubric v{n}", { n: a.rubric_version })}
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          {at >= 0 && <span className="text-sm text-muted-foreground">{t("{n} of {total}", { n: at + 1, total: ids.length })}</span>}
          <Button size="sm" variant="outline" aria-label={t("Previous answer")} disabled={at <= 0} onClick={() => go(at - 1)}><ChevronLeft /> {t("Prev")}</Button>
          <Button size="sm" variant="outline" aria-label={t("Next answer")} disabled={at < 0 || at >= ids.length - 1} onClick={() => go(at + 1)}>{t("Next")} <ChevronRight /></Button>
        </div>
      </div>
      <ErrorText>{ans.error}</ErrorText>
      {a && (
        <>
          {a.versions.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t("Versions:")}</span>
              {a.versions.map((v) => (
                <Button key={v.id} size="sm" variant={v.id === a.id ? "default" : "outline"}
                        onClick={() => navigate(`/answers/${v.id}${ctxParam ? `?ctx=${ctxParam}` : ""}`)}>
                  v{v.version} · {when(v.created_at)}{v.selected ? ` · ${t("graded")}` : ""}
                </Button>
              ))}
              {!a.selected && <Button size="sm" variant="secondary" disabled={act.busy}
                                      onClick={() => act.run(async () => { ans.setData(await api.post<AnswerDetail>(`/api/answers/${a.id}/select`)); await list.reload(); })}>
                {t("Grade this version instead")}</Button>}
            </div>
          )}
          <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <ImageViewer pages={a.pages} toolsBelow className="lg:flex lg:min-h-0 lg:flex-col"
                         boxClass="h-[calc(var(--app-h)*0.6)] lg:h-auto lg:min-h-0 lg:flex-1" />
            <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
              {a.rubric && <ApprovalForm key={`${a.id}-${run?.id ?? "none"}-${a.approval?.approved_at ?? ""}`} a={a} run={run}
                                         onDone={(next) => { ans.setData(next); list.reload(); }} />}
              {!a.rubric && <p className="text-sm text-muted-foreground">{t("Accept the problem's grader before grading this answer.")}</p>}
              <Proposal a={a} run={run} onGrade={() => act.run(async () => { await api.post("/api/answers/grade", { answer_ids: [a.id] }); await ans.reload(); })} busy={act.busy} />
              <ErrorText>{act.error}</ErrorText>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** One AI stage (I5); the first two fold away so the scores are what the teacher sees first. */
function Stage({ n, title, fold, children }: { n?: number; title: string; fold?: boolean; children: React.ReactNode }) {
  const head = <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{n ? `${n} · ` : ""}{title}</span>;
  if (!fold) return <section className="space-y-2"><h3>{head}</h3>{children}</section>;
  return (
    <details className="group space-y-2">
      <summary className="flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90" />{head}
      </summary>
      {children}
    </details>
  );
}

const CONF: Record<CriterionScore["confidence"], string> = {
  high: "border-success/60 text-success", medium: "border-warning bg-warning/15", low: "border-destructive bg-destructive/10 text-destructive",
};

function Proposal({ a, run, onGrade, busy }: { a: AnswerDetail; run?: RunOut; onGrade: () => void; busy: boolean }) {
  const h = run?.harness;
  const canGrade = a.state !== "running" && a.state !== "approved" && a.selected;
  const proposed = run?.status === "proposed" && h;
  const check = proposed ? h.criteria.filter((c) => c.confidence !== "high").map((c) => c.criterion_id) : [];
  return (
    <Card className="gap-4 bg-muted/30 py-4 shadow-none">
      <CardHeader className="gap-1 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{t("AI proposal")}</CardTitle>
          {proposed && <span className="ml-auto font-semibold tabular-nums text-muted-foreground">{pts(run.total)} / {pts(run.max_points)}</span>}
          {canGrade && <Button size="sm" variant={run ? "outline" : "default"} className={proposed ? "" : "ml-auto"} disabled={busy} onClick={onGrade}>{run ? t("Grade again") : t("Grade with AI")}</Button>}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("(a draft until you approve)")}
          {check.length > 0 && <> · <span className="font-medium text-foreground">{t("Check first: {ids}", { ids: check.join(", ") })}</span></>}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        {!run && <p className="text-sm text-muted-foreground">{t("Not graded yet.")}</p>}
        {run?.status === "running" && <p className="animate-pulse text-sm">{t("The AI is reading this answer…")}</p>}
        {run?.status === "failed" && (
          <p role="alert" className="rounded-md border border-destructive bg-destructive/10 p-2 text-sm">
            {t("Grading failed, so there is no score.")} {run.error}
          </p>
        )}
        {run?.status === "review_required" && (
          <div role="alert" className="rounded-md border border-warning bg-warning/15 p-2 text-sm">
            {t("The AI did not propose a score: review this answer yourself.")}
            {h?.review_reasons.length ? <ul className="mt-1 list-disc pl-5">{h.review_reasons.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
          </div>
        )}
        {proposed && (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2">
            {h.criteria.map((c) => {
              const rc = a.rubric?.criteria.find((x) => x.id === c.criterion_id);
              return (
                <li key={c.criterion_id} title={rc?.description} className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 p-2 ${CONF[c.confidence]}`}>
                  <span className="text-sm font-semibold text-foreground">{c.criterion_id}</span>
                  <span className="text-2xl font-bold tabular-nums text-foreground">{pts(c.points)}<span className="text-sm font-medium text-muted-foreground">/{pts(rc?.max_points)}</span></span>
                  <span className="text-center text-xs leading-tight">{t("confidence: {level}", { level: t(c.confidence) })}</span>
                </li>
              );
            })}
          </ul>
        )}
        {h && (
          <div className="space-y-2 border-t pt-3">
            <Stage n={1} title={t("Transcription")} fold><p className="whitespace-pre-wrap rounded bg-muted p-2 font-mono text-sm">{h.transcription || "—"}</p></Stage>
            <Stage n={2} title={t("Physics interpretation")} fold>
              <p className="text-sm">{h.interpretation || "—"}</p>
              {h.diagram_observations && <p className="text-sm text-muted-foreground">{t("Diagram:")} {h.diagram_observations}</p>}
            </Stage>
            {proposed && (
              <Stage n={3} title={t("Proposed scores")} fold>
                <ul className="space-y-2">
                  {h.criteria.map((c) => {
                    const rc = a.rubric?.criteria.find((x) => x.id === c.criterion_id);
                    return (
                      <li key={c.criterion_id} className="space-y-2 rounded-lg border bg-card p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="min-w-0 flex-1 font-medium">{c.criterion_id} · {rc?.description}</span>
                          <Badge variant="outline" className={CONF[c.confidence]}>{t("confidence: {level}", { level: t(c.confidence) })}</Badge>
                          <span className="shrink-0 font-semibold tabular-nums">{pts(c.points)} / {pts(rc?.max_points)}</span>
                        </div>
                        <blockquote className="border-l-2 pl-2 text-muted-foreground">
                          <span className="text-xs">{t("Evidence ({source}):", { source: c.source })}</span> <q className="italic">{c.evidence}</q>
                        </blockquote>
                        <p><span className="text-muted-foreground">{t("Why:")}</span> {c.reasoning}</p>
                      </li>
                    );
                  })}
                </ul>
              </Stage>
            )}
            {proposed && h.feedback && <Stage title={t("Suggested feedback")} fold><p className="text-sm">{h.feedback}</p></Stage>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** PL-23 and PL-24: final points per criterion, feedback, and whether the AI was right. */
function ApprovalForm({ a, run, onDone }: { a: AnswerDetail; run?: RunOut; onDone: (a: AnswerDetail) => void }) {
  const rubric = a.rubric!;
  const proposed = run?.status === "proposed" ? Object.fromEntries(run.harness!.criteria.map((c) => [c.criterion_id, c.points])) : {};
  const approved = a.approval ? Object.fromEntries(a.approval.scores.map((s) => [s.criterion_id, s.points])) : null;
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(rubric.criteria.map((c) => [c.id, String(approved?.[c.id] ?? proposed[c.id] ?? "")])));
  const [feedback, setFeedback] = useState(a.approval?.feedback ?? run?.harness?.feedback ?? "");
  const [verdict, setVerdict] = useState<"correct" | "wrong" | null>(a.approval?.ai_verdict ?? null);
  const [wrong, setWrong] = useState<string[]>(a.approval?.wrong_criteria ?? []);
  const [reason, setReason] = useState<string>(a.approval?.wrong_reason ?? "");
  const [note, setNote] = useState(a.approval?.wrong_note ?? "");
  const act = useAction();
  const aiRan = run && run.status !== "running" && run.status !== "failed";
  const total = rubric.criteria.reduce((s, c) => s + (Number(scores[c.id]) || 0), 0);
  const max = rubric.criteria.reduce((s, c) => s + c.max_points, 0);
  const missing = rubric.criteria.some((c) => scores[c.id] === "" || Number(scores[c.id]) < 0 || Number(scores[c.id]) > c.max_points);
  const needVerdict = aiRan && !verdict;
  const needWhy = verdict === "wrong" && (!reason || (!wrong.length && !note.trim()));

  const submit = () => act.run(async () => onDone(await api.post<AnswerDetail>(`/api/answers/${a.id}/approve`, {
    run_id: run && run.status !== "running" ? run.id : null,
    scores: rubric.criteria.map((c) => ({ criterion_id: c.id, points: Number(scores[c.id]) })),
    feedback, ai_verdict: verdict, wrong_criteria: verdict === "wrong" ? wrong : [],
    wrong_reason: verdict === "wrong" ? reason : null, wrong_note: verdict === "wrong" ? note : "",
  })));

  return (
    <Card className={`border-2 shadow-md ${a.approval ? "border-success" : "border-primary"}`}>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle className="text-lg">{a.approval ? t("Approved") : t("Your grade")}</CardTitle>
          <span className={`ml-auto text-3xl font-bold tabular-nums ${a.approval ? "text-success" : ""}`}>{pts(total)}<span className="text-lg font-medium text-muted-foreground"> / {pts(max)}</span></span>
        </div>
        {a.approval && <p className="text-sm text-muted-foreground">{t("Approved {when}. You can change it and approve again.", { when: when(a.approval.approved_at) })}</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* the teacher knows the rubric: the id is enough, the description is on hover */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
          {rubric.criteria.map((c) => (
            <label key={c.id} title={c.description} className="flex items-center gap-2 rounded-lg border px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.id}</span>
              <Input type="number" inputMode="decimal" step={0.5} min={0} max={c.max_points} className="h-10 w-14 px-2 text-right text-xl font-bold tabular-nums md:text-xl" aria-label={t("{criterion} points", { criterion: `${c.id} · ${c.description}` })}
                     value={scores[c.id]} onChange={(e) => setScores({ ...scores, [c.id]: e.target.value })} />
              <span className="text-sm font-medium text-muted-foreground">/{pts(c.max_points)}</span>
            </label>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t("Feedback for the student")}</span>
          <Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </label>
        {aiRan && (
          <fieldset className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">{t("Was the AI right? (for evaluation, never shown to students)")}</legend>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={verdict === "correct" ? "default" : "outline"} aria-pressed={verdict === "correct"} onClick={() => setVerdict("correct")}>{t("Correct")}</Button>
              <Button type="button" size="sm" variant={verdict === "wrong" ? "destructive" : "outline"} aria-pressed={verdict === "wrong"} onClick={() => setVerdict("wrong")}>{t("Wrong")}</Button>
            </div>
            {verdict === "wrong" && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-3">
                  {rubric.criteria.map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5 text-sm">
                      <Checkbox checked={wrong.includes(c.id)} onCheckedChange={(v) => setWrong(v ? [...wrong, c.id] : wrong.filter((x) => x !== c.id))} /> {c.id}
                    </label>
                  ))}
                </div>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="w-full sm:w-72" aria-label={t("Why the AI was wrong")}><SelectValue placeholder={t("Why was it wrong?")} /></SelectTrigger>
                  <SelectContent>{REASONS.map(([v, l]) => <SelectItem key={v} value={v}>{t(l)}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder={t("Short note (optional if you ticked criteria)")} value={note} onChange={(e) => setNote(e.target.value)} aria-label={t("Note")} />
              </div>
            )}
          </fieldset>
        )}
        <ErrorText>{act.error}</ErrorText>
        <Button className="w-full" disabled={act.busy || missing || !!needVerdict || needWhy || a.state === "running"} onClick={submit}>
          {a.approval ? t("Approve again") : t("Approve grade")}
        </Button>
        {(missing || needVerdict || needWhy) && (
          <p className="text-xs text-muted-foreground">
            {missing ? t("Give points for every criterion, within its maximum.") + " " : ""}
            {needVerdict ? t("Say whether the AI was correct or wrong.") + " " : ""}
            {needWhy ? t("Say why the AI was wrong: a reason, and the criteria or a note.") : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** PL-53: the pencil by the title. The label can always change; the name and the group only on the
 * teacher's own upload outside an exam (a student's typed name is kept, and in an exam they decide versions). */
function EditAnswer({ a, onSaved }: { a: AnswerDetail; onSaved: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(a.student_name);
  const [label, setLabel] = useState(a.label);
  const [group, setGroup] = useState<Group | null>(null);
  const groups = useLoad(() => api.get<Group[]>("/api/groups"), []);
  const act = useAction();
  const fixed = a.source === "student" || !!a.exam_id;
  useEffect(() => {  // fill the form from the answer each time it opens
    if (!open) return;
    setName(a.student_name); setLabel(a.label); act.setError(null);
    setGroup(groups.data?.find((g) => g.id === a.group_id) ?? null);
  }, [open, a, groups.data]);  // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => act.run(async () => {
    await api.patch(`/api/answers/${a.id}`, fixed ? { label } : { label, student_name: name, group_id: group?.id ?? null });
    await onSaved();
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label={t("Edit answer")} title={t("Edit answer")}><Pencil /></Button>
      </DialogTrigger>
      <DialogContent>
        <form className="min-w-0 space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <DialogHeader>
            <DialogTitle>{t("Edit answer")}</DialogTitle>
            {fixed && <DialogDescription>
              {a.source === "student" ? t("The student typed this name when uploading, so it is kept with the upload.")
                : t("In an exam the name and group decide the student's versions, so they are kept.")}
            </DialogDescription>}
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="answer-name">{t("Student name")}</Label>
            <Input id="answer-name" value={name} disabled={fixed} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="answer-label">{t("Label")}</Label>
            <Input id="answer-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-medium">{t("Group")}</p>
            {groups.data && <GroupPick groups={groups.data.filter((g) => !g.archived || g.id === a.group_id)} value={group} onChange={setGroup} locked={fixed} />}
          </div>
          <ErrorText>{act.error ?? groups.error}</ErrorText>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">{t("Cancel")}</Button></DialogClose>
            <Button type="submit" disabled={act.busy || !groups.data}>{t("Save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
