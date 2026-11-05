import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ImageViewer from "@/components/ImageViewer";
import { Back, ErrorText, StateBadge, pts, useAction, useLoad, when } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, type AnswerDetail, type AnswerRow, type CriterionScore, type RunOut } from "@/lib/api";
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
  if (kind === "exam") return { back: `/exams/${a}?group=${b}`, label: "Exam", list: () => api.get<{ answers: AnswerRow[] }>(`/api/exams/${a}/groups/${b}/answers`).then((r) => r.answers) };
  if (kind === "problem") return { back: `/problems/${a}`, label: "Problem", list: () => api.get<AnswerRow[]>(`/api/problems/${a}/answers`) };
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
    const t = setInterval(ans.reload, 2000);
    return () => clearInterval(t);
  }, [a?.state, ans.reload]);

  const ids = (list.data ?? []).filter((r) => r.selected).map((r) => r.id);
  const at = ids.indexOf(id);
  const go = (j: number) => navigate(`/answers/${ids[j]}${ctxParam ? `?ctx=${ctxParam}` : ""}`);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {ctx && <Back to={ctx.back}>{ctx.label}</Back>}
        <div className="ml-auto flex items-center gap-1">
          {at >= 0 && <span className="text-sm text-muted-foreground">{at + 1} of {ids.length}</span>}
          <Button size="sm" variant="outline" aria-label="Previous answer" disabled={at <= 0} onClick={() => go(at - 1)}><ChevronLeft /> Prev</Button>
          <Button size="sm" variant="outline" aria-label="Next answer" disabled={at < 0 || at >= ids.length - 1} onClick={() => go(at + 1)}>Next <ChevronRight /></Button>
        </div>
      </div>
      <ErrorText>{ans.error}</ErrorText>
      {a && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{a.student_name || a.label || "Unnamed answer"}</h1>
            <StateBadge state={a.state} />
            <span className="text-sm text-muted-foreground">
              {a.problem_title} · {a.source === "student" ? "uploaded by the student" : "uploaded by you"} {when(a.created_at)} · rubric v{a.rubric_version}
            </span>
          </div>
          {a.versions.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Versions:</span>
              {a.versions.map((v) => (
                <Button key={v.id} size="sm" variant={v.id === a.id ? "default" : "outline"}
                        onClick={() => navigate(`/answers/${v.id}${ctxParam ? `?ctx=${ctxParam}` : ""}`)}>
                  v{v.version} · {when(v.created_at)}{v.selected ? " · graded" : ""}
                </Button>
              ))}
              {!a.selected && <Button size="sm" variant="secondary" disabled={act.busy}
                                      onClick={() => act.run(async () => { ans.setData(await api.post<AnswerDetail>(`/api/answers/${a.id}/select`)); await list.reload(); })}>
                Grade this version instead</Button>}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-16 lg:self-start"><ImageViewer pages={a.pages} /></div>
            <div className="space-y-4">
              <Proposal a={a} run={run} onGrade={() => act.run(async () => { await api.post("/api/answers/grade", { answer_ids: [a.id] }); await ans.reload(); })} busy={act.busy} />
              <ErrorText>{act.error}</ErrorText>
              {a.rubric && <ApprovalForm key={`${a.id}-${run?.id ?? "none"}-${a.approval?.approved_at ?? ""}`} a={a} run={run}
                                         onDone={(next) => { ans.setData(next); list.reload(); }} />}
              {!a.rubric && <p className="text-sm text-muted-foreground">Accept the problem's grader before grading this answer.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stage({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{n} · {title}</h3>
      {children}
    </section>
  );
}

const CONF: Record<CriterionScore["confidence"], string> = { high: "border-success", medium: "border-warning", low: "border-destructive" };

function Proposal({ a, run, onGrade, busy }: { a: AnswerDetail; run?: RunOut; onGrade: () => void; busy: boolean }) {
  const h = run?.harness;
  const canGrade = a.state !== "running" && a.state !== "approved" && a.selected;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>AI proposal <span className="text-sm font-normal text-muted-foreground">(a draft until you approve)</span></CardTitle>
        {canGrade && <Button size="sm" variant={run ? "outline" : "default"} disabled={busy} onClick={onGrade}>{run ? "Grade again" : "Grade with AI"}</Button>}
      </CardHeader>
      <CardContent className="space-y-4">
        {!run && <p className="text-sm text-muted-foreground">Not graded yet.</p>}
        {run?.status === "running" && <p className="animate-pulse text-sm">The AI is reading this answer…</p>}
        {run?.status === "failed" && (
          <p role="alert" className="rounded-md border border-destructive bg-destructive/10 p-2 text-sm">
            Grading failed, so there is no score. {run.error}
          </p>
        )}
        {run?.status === "review_required" && (
          <div role="alert" className="rounded-md border border-warning bg-warning/15 p-2 text-sm">
            The AI did not propose a score: review this answer yourself.
            {h?.review_reasons.length ? <ul className="mt-1 list-disc pl-5">{h.review_reasons.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
          </div>
        )}
        {h && (
          <>
            <Stage n={1} title="Transcription"><p className="whitespace-pre-wrap rounded bg-muted p-2 font-mono text-sm">{h.transcription || "—"}</p></Stage>
            <Stage n={2} title="Physics interpretation">
              <p className="text-sm">{h.interpretation || "—"}</p>
              {h.diagram_observations && <p className="text-sm text-muted-foreground">Diagram: {h.diagram_observations}</p>}
            </Stage>
            {run.status === "proposed" && (
              <Stage n={3} title={`Proposed scores · ${pts(run.total)} / ${pts(run.max_points)}`}>
                <ul className="space-y-2">
                  {h.criteria.map((c) => {
                    const rc = a.rubric?.criteria.find((x) => x.id === c.criterion_id);
                    return (
                      <li key={c.criterion_id} className={`space-y-0.5 rounded-md border-l-4 bg-muted/50 p-2 text-sm ${CONF[c.confidence]}`}>
                        <div className="flex justify-between gap-2 font-medium">
                          <span>{c.criterion_id} · {rc?.description}</span>
                          <span className="tabular-nums">{pts(c.points)} / {pts(rc?.max_points)}</span>
                        </div>
                        <div><span className="text-muted-foreground">Evidence ({c.source}):</span> {c.evidence}</div>
                        <div><span className="text-muted-foreground">Why:</span> {c.reasoning}</div>
                        <Badge variant="outline" className="mt-1">confidence: {c.confidence}</Badge>
                      </li>
                    );
                  })}
                </ul>
                {h.feedback && <p className="text-sm"><span className="text-muted-foreground">Suggested feedback:</span> {h.feedback}</p>}
              </Stage>
            )}
          </>
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
    <Card className={a.approval ? "border-success" : "border-primary"}>
      <CardHeader>
        <CardTitle>{a.approval ? `Approved · ${pts(a.approval.total)} / ${pts(max)}` : "Your grade"}</CardTitle>
        {a.approval && <p className="text-sm text-muted-foreground">Approved {when(a.approval.approved_at)}. You can change it and approve again.</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {rubric.criteria.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1">{c.id} · {c.description}</span>
              {proposed[c.id] !== undefined && Number(scores[c.id]) !== proposed[c.id] && <Badge variant="outline">AI: {pts(proposed[c.id])}</Badge>}
              <Input type="number" inputMode="decimal" step={0.5} min={0} max={c.max_points} className="w-20 text-right" aria-label={`${c.id} points`}
                     value={scores[c.id]} onChange={(e) => setScores({ ...scores, [c.id]: e.target.value })} />
              <span className="w-10 text-muted-foreground">/ {pts(c.max_points)}</span>
            </label>
          ))}
          <div className="text-right text-sm font-semibold tabular-nums">Total {pts(total)} / {pts(max)}</div>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Feedback for the student</span>
          <Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        </label>
        {aiRan && (
          <fieldset className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Was the AI right? (for evaluation, never shown to students)</legend>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={verdict === "correct" ? "default" : "outline"} aria-pressed={verdict === "correct"} onClick={() => setVerdict("correct")}>Correct</Button>
              <Button type="button" size="sm" variant={verdict === "wrong" ? "destructive" : "outline"} aria-pressed={verdict === "wrong"} onClick={() => setVerdict("wrong")}>Wrong</Button>
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
                  <SelectTrigger className="w-full sm:w-72" aria-label="Why the AI was wrong"><SelectValue placeholder="Why was it wrong?" /></SelectTrigger>
                  <SelectContent>{REASONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Short note (optional if you ticked criteria)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
              </div>
            )}
          </fieldset>
        )}
        <ErrorText>{act.error}</ErrorText>
        <Button className="w-full" disabled={act.busy || missing || !!needVerdict || needWhy || a.state === "running"} onClick={submit}>
          {a.approval ? "Approve again" : "Approve grade"}
        </Button>
        {(missing || needVerdict || needWhy) && (
          <p className="text-xs text-muted-foreground">
            {missing ? "Give points for every criterion, within its maximum. " : ""}
            {needVerdict ? "Say whether the AI was correct or wrong. " : ""}
            {needWhy ? "Say why the AI was wrong: a reason, and the criteria or a note." : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
