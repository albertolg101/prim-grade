import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import Answers from "@/components/Answers";
import Capture from "@/components/Capture";
import { Back, ErrorText, Page, useAction, useLoad } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, fileUrl, pagesForm, type Criterion, type Page as UploadPage, type Problem, type Proposal } from "@/lib/api";
import { query } from "@/lib/router";

export default function ProblemPage({ id }: { id: string }) {
  const prob = useLoad(() => api.get<Problem>(`/api/problems/${id}`), [id]);
  const p = prob.data;
  const from = query("exam");
  if (!p) return <Page title="Problem"><ErrorText>{prob.error}</ErrorText></Page>;
  const set = (next: Problem) => prob.setData(next);
  return (
    <Page title={p.title}
          back={<Back to={from ? `/exams/${from}` : "/problems"}>{from ? "Exam" : "Problems"}</Back>}
          actions={p.status === "ready" ? <Badge>Ready · rubric v{p.rubric_version}</Badge> : <Badge variant="outline">Draft</Badge>}>
      <Sources p={p} onSaved={set} />
      <Grader p={p} onSaved={set} />
      {(p.status === "ready" || p.answers > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Answers</CardTitle>
            <CardDescription>Add one answer per student (one or more pages). Grading only starts when you ask for it.</CardDescription>
          </CardHeader>
          <CardContent><Answers problemId={p.id} ready={p.status === "ready"} /></CardContent>
        </Card>
      )}
    </Page>
  );
}

/** PL-15, PL-16 inputs: title, statement and solution as text and/or images, optional rubric. */
function Sources({ p, onSaved }: { p: Problem; onSaved: (p: Problem) => void }) {
  const [f, setF] = useState({ title: p.title, statement_text: p.statement_text, solution_text: p.solution_text, rubric_text: p.rubric_text });
  const [pages, setPages] = useState<Record<"statement" | "solution", UploadPage[]>>({ statement: [], solution: [] });
  const act = useAction();
  const dirty = f.title !== p.title || f.statement_text !== p.statement_text || f.solution_text !== p.solution_text || f.rubric_text !== p.rubric_text;
  const upload = (role: "statement" | "solution") => act.run(async () => {
    onSaved(await api.form<Problem>(`/api/problems/${p.id}/files`, pagesForm(pages[role], { role })));
    setPages({ ...pages, [role]: [] });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>1 · Statement and reference solution</CardTitle>
        <CardDescription>Type them, add images, or both. The AI reads all of it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="t">Title</Label>
          <Input id="t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        {(["statement", "solution"] as const).map((role) => (
          <div key={role} className="space-y-2">
            <Label htmlFor={role}>{role === "statement" ? "Statement" : "Reference solution"}</Label>
            <Textarea id={role} rows={4} value={f[`${role}_text`]} onChange={(e) => setF({ ...f, [`${role}_text`]: e.target.value })} />
            {p.files.filter((x) => x.role === role).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {p.files.filter((x) => x.role === role).map((x) => (
                  <figure key={x.link_id} className="relative">
                    <a href={fileUrl(x.id)} target="_blank" rel="noreferrer"><img src={fileUrl(x.id)} alt={x.name} className="h-24 rounded border object-cover" /></a>
                    <button type="button" aria-label={`Remove ${x.name}`} className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5"
                            onClick={() => act.run(async () => onSaved(await api.del<Problem>(`/api/problems/${p.id}/files/${x.link_id}`)))}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </figure>
                ))}
              </div>
            )}
            <Capture label={`${role} pages`} pages={pages[role]} onChange={(v) => setPages({ ...pages, [role]: v })} />
            {pages[role].length > 0 && <Button size="sm" disabled={act.busy} onClick={() => upload(role)}>Add {pages[role].length} page(s)</Button>}
          </div>
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="rubric">Your rubric (optional)</Label>
          <Textarea id="rubric" rows={3} placeholder="Leave empty and the AI proposes one." value={f.rubric_text} onChange={(e) => setF({ ...f, rubric_text: e.target.value })} />
        </div>
        <ErrorText>{act.error}</ErrorText>
        <Button disabled={!dirty || !f.title.trim() || act.busy}
                onClick={() => act.run(async () => onSaved(await api.patch<Problem>(`/api/problems/${p.id}`, f)))}>
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function criterionErrors(c: Criterion, all: Criterion[]): string[] {
  const out = [];
  if (!c.id.trim()) out.push("needs an id");
  if (all.filter((x) => x.id === c.id).length > 1) out.push("duplicate id");
  if (!(c.max_points > 0)) out.push("points must be more than 0");
  if (!c.description.trim()) out.push("needs a description");
  return out;
}

/** PL-16 to PL-19: generate, edit every field, improve by instruction, accept a version. */
function Grader({ p, onSaved }: { p: Problem; onSaved: (p: Problem) => void }) {
  const [draft, setDraft] = useState<Proposal | null>(p.proposal);
  const [ack, setAck] = useState(false);
  const [instruction, setInstruction] = useState("");
  const act = useAction();
  useEffect(() => setDraft(p.proposal), [p.proposal]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(p.proposal);
  const has = (p.statement_text.trim() || p.files.some((f) => f.role === "statement")) && (p.solution_text.trim() || p.files.some((f) => f.role === "solution"));

  if (!draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>2 · Grader</CardTitle>
          <CardDescription>The AI reads the statement and the solution and proposes a rubric. You check and edit everything.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!has && <p className="text-sm text-muted-foreground">Add the statement and the reference solution first.</p>}
          <Button disabled={!has || act.busy} onClick={() => act.run(async () => onSaved(await api.post<Problem>(`/api/problems/${p.id}/generate`)))}>
            {act.busy ? "Preparing…" : "Prepare the grader with AI"}
          </Button>
          <ErrorText>{act.error}</ErrorText>
        </CardContent>
      </Card>
    );
  }

  const d = draft;
  const up = (patch: Partial<Proposal>) => setDraft({ ...d, ...patch });
  const crit = d.rubric.criteria;
  const setCrit = (criteria: Criterion[]) => up({ rubric: { ...d.rubric, criteria } });
  const total = crit.reduce((s, c) => s + (Number(c.max_points) || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>2 · What the AI understood</CardTitle>
        <CardDescription>Every field is editable. Saving an edit to a ready problem makes it a draft; accepting creates the next rubric version, and earlier grades keep theirs.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {p.pending_proposal && (
          <Diff before={p.proposal!} after={p.pending_proposal} instruction={p.pending_instruction ?? ""} busy={act.busy}
                onChoose={(c) => act.run(async () => onSaved(await api.post<Problem>(`/api/problems/${p.id}/improve/${c}`)))} />
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Statement (as read)"><Textarea rows={4} value={d.normalized_statement} onChange={(e) => up({ normalized_statement: e.target.value })} /></Field>
          <Field label="Solution (as read)"><Textarea rows={4} value={d.normalized_solution} onChange={(e) => up({ normalized_solution: e.target.value })} /></Field>
          <ListField label="Final answers" value={d.final_answers} onChange={(v) => up({ final_answers: v })} />
          <ListField label="Assumptions" value={d.assumptions} onChange={(v) => up({ assumptions: v })} />
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={d.diagram_required} onCheckedChange={(v) => up({ diagram_required: v === true })} /> A diagram is required
            </label>
            {d.diagram_required && <ListField label="Expected forces" value={d.expected_forces} onChange={(v) => up({ expected_forces: v })} />}
          </div>
          <ListField label="Grading plan" value={d.grading_plan} onChange={(v) => up({ grading_plan: v })} />
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Rubric · {total} points</h3>
            <Button size="sm" variant="outline" onClick={() => setCrit([...crit, {
              id: `C${crit.length + 1}`, description: "", max_points: 1, required_evidence: "", full_credit: "", partial_credit: "", zero_credit: "",
            }])}><Plus /> Criterion</Button>
          </div>
          {crit.map((c, i) => {
            const errs = criterionErrors(c, crit);
            const edit = (patch: Partial<Criterion>) => setCrit(crit.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            const swap = (j: number) => { const n = [...crit]; [n[i], n[j]] = [n[j], n[i]]; setCrit(n); };
            return (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Id" className="w-20"><Input value={c.id} onChange={(e) => edit({ id: e.target.value })} /></Field>
                  <Field label="Points" className="w-24"><Input type="number" min={0} step={0.5} value={c.max_points} onChange={(e) => edit({ max_points: Number(e.target.value) })} /></Field>
                  <Field label="Description" className="min-w-40 flex-1"><Input value={c.description} onChange={(e) => edit({ description: e.target.value })} /></Field>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => swap(i - 1)}><ArrowUp /></Button>
                    <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === crit.length - 1} onClick={() => swap(i + 1)}><ArrowDown /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Remove ${c.id}`} onClick={() => setCrit(crit.filter((_, j) => j !== i))}><Trash2 /></Button>
                  </div>
                </div>
                {errs.length > 0 && <p className="text-sm text-destructive">{c.id || "Criterion"}: {errs.join(", ")}</p>}
                <div className="grid gap-2 md:grid-cols-2">
                  <Field label="Required evidence"><Textarea rows={2} value={c.required_evidence} onChange={(e) => edit({ required_evidence: e.target.value })} /></Field>
                  <Field label="Full credit"><Textarea rows={2} value={c.full_credit} onChange={(e) => edit({ full_credit: e.target.value })} /></Field>
                  <Field label="Partial credit"><Textarea rows={2} value={c.partial_credit} onChange={(e) => edit({ partial_credit: e.target.value })} /></Field>
                  <Field label="Zero credit"><Textarea rows={2} value={c.zero_credit} onChange={(e) => edit({ zero_credit: e.target.value })} /></Field>
                </div>
              </div>
            );
          })}
          <div className="grid gap-2 md:grid-cols-3">
            <Field label="Carried errors"><Textarea rows={2} value={d.rubric.carried_error_policy} onChange={(e) => up({ rubric: { ...d.rubric, carried_error_policy: e.target.value } })} /></Field>
            <Field label="Tolerances"><Textarea rows={2} value={d.rubric.tolerances} onChange={(e) => up({ rubric: { ...d.rubric, tolerances: e.target.value } })} /></Field>
            <Field label="Alternative methods"><Textarea rows={2} value={d.rubric.alternative_methods} onChange={(e) => up({ rubric: { ...d.rubric, alternative_methods: e.target.value } })} /></Field>
          </div>
        </section>

        {d.issues.length > 0 && (
          <section className="space-y-2 rounded-lg border border-warning bg-warning/10 p-3">
            <h3 className="font-semibold">Issues the AI found</h3>
            <ul className="list-disc pl-5 text-sm">{d.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} /> I have read these issues</label>
          </section>
        )}
        {p.rubric_errors.length > 0 && !dirty && <ErrorText>{`Fix the rubric: ${p.rubric_errors.join("; ")}`}</ErrorText>}
        <ErrorText>{act.error}</ErrorText>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!dirty || act.busy} onClick={() => act.run(async () => onSaved(await api.put<Problem>(`/api/problems/${p.id}/proposal`, { proposal: d })))}>Save edits</Button>
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(p.proposal)}>Undo edits</Button>
          <Button disabled={dirty || p.status === "ready" || act.busy || (d.issues.length > 0 && !ack)}
                  onClick={() => act.run(async () => onSaved(await api.post<Problem>(`/api/problems/${p.id}/accept`, { issues_acknowledged: ack })))}>
            {p.status === "ready" ? `Accepted · v${p.rubric_version}` : `Accept as rubric v${p.rubric_version + 1}`}
          </Button>
        </div>

        <section className="space-y-2 border-t pt-4">
          <Label htmlFor="ins" className="font-semibold">Improve with an instruction</Label>
          <Textarea id="ins" rows={2} placeholder="e.g. C2 should accept g = 9.8 or 10; the diagram needs friction"
                    value={instruction} onChange={(e) => setInstruction(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!instruction.trim() || dirty || act.busy || !!p.pending_proposal}
                    onClick={() => act.run(async () => { onSaved(await api.post<Problem>(`/api/problems/${p.id}/improve`, { instruction })); setInstruction(""); })}>
              {act.busy ? "Asking the AI…" : "Ask the AI to revise"}
            </Button>
            <Button variant="ghost" disabled={act.busy} onClick={() => { if (confirm("Replace the whole proposal with a fresh one from the AI?")) act.run(async () => onSaved(await api.post<Problem>(`/api/problems/${p.id}/generate`))); }}>
              Prepare again from scratch
            </Button>
          </div>
          {dirty && <p className="text-xs text-muted-foreground">Save or undo your edits before asking the AI.</p>}
        </section>
      </CardContent>
    </Card>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`block space-y-1 ${className ?? ""}`}><span className="text-sm font-medium">{label}</span>{children}</label>;
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join("\n"));
  useEffect(() => { if (lines(text).join("\n") !== value.join("\n")) setText(value.join("\n")); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Field label={`${label} (one per line)`}>
      <Textarea rows={3} value={text} onChange={(e) => { setText(e.target.value); onChange(lines(e.target.value)); }} />
    </Field>
  );
}

/** PL-18 / AC-P06: what the revision changes, field by field. */
function flat(o: unknown, path = "", out: Record<string, string> = {}): Record<string, string> {
  if (Array.isArray(o) && o.every((x) => typeof x !== "object")) out[path] = o.join(" · ");
  else if (o && typeof o === "object") {
    const crit = Array.isArray(o);
    Object.entries(o).forEach(([k, v]) => flat(v, path ? `${path} › ${crit ? (v as Criterion).id ?? k : k}` : k, out));
  } else out[path] = String(o);
  return out;
}

function Diff({ before, after, instruction, busy, onChoose }: {
  before: Proposal; after: Proposal; instruction: string; busy: boolean; onChoose: (c: "keep" | "discard") => void;
}) {
  const a = flat(before), b = flat(after);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
  return (
    <section className="space-y-3 rounded-lg border-2 border-primary p-3">
      <h3 className="font-semibold">Revised by the AI: “{instruction}”</h3>
      {keys.length === 0 ? <p className="text-sm text-muted-foreground">The AI changed nothing.</p> : (
        <ul className="space-y-2 text-sm">
          {keys.map((k) => (
            <li key={k} className="rounded bg-muted p-2">
              <div className="text-xs font-medium text-muted-foreground">{k.replaceAll("_", " ")}</div>
              {a[k] !== undefined && <div className="text-destructive line-through">{a[k] || "(empty)"}</div>}
              {b[k] !== undefined && <div className="text-success">{b[k] || "(empty)"}</div>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => onChoose("keep")}>Keep the revision</Button>
        <Button variant="outline" disabled={busy} onClick={() => onChoose("discard")}>Discard it</Button>
      </div>
    </section>
  );
}

