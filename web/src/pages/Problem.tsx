import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Plus, Trash2, X } from "lucide-react";
import Answers from "@/components/Answers";
import Capture from "@/components/Capture";
import { ErrorText, Page, useAction, useLoad } from "@/components/common";
import ImageViewer from "@/components/ImageViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { api, fileUrl, pagesForm, type Criterion, type Page as UploadPage, type Problem, type Proposal } from "@/lib/api";
import { t } from "@/lib/i18n";
import { navigate, query } from "@/lib/router";
import { cn } from "@/lib/utils";

type View = "info" | "grader";
type ProblemFile = Problem["files"][number];

/** PL-15 to PL-20 on two screens: what the teacher gives, and what the AI generated from it. */
export default function ProblemPage({ id }: { id: string }) {
  const prob = useLoad(() => api.get<Problem>(`/api/problems/${id}`), [id]);
  const p = prob.data;
  const from = query("exam");
  const view: View = query("view") === "grader" ? "grader" : "info";
  const edit = useAction();  // rename and tags
  const go = (v: View) => {
    const q = new URLSearchParams(from ? { exam: from } : {});
    if (v === "grader") q.set("view", "grader");
    navigate(`/problems/${id}${q.size ? `?${q}` : ""}`);
  };
  if (!p) return <Page title={t("Problem")}><ErrorText>{prob.error}</ErrorText></Page>;
  const set = (next: Problem) => prob.setData(next);
  const tabs: [View, string][] = [["info", t("1 · Problem information")], ["grader", t("2 · AI grader")]];
  return (
    <Page title={p.title}
          onRename={(title) => edit.run(async () => set(await api.patch<Problem>(`/api/problems/${p.id}`, { title })))}
          crumbs={from ? [[t("Exams"), "/exams"], [t("Exam"), `/exams/${from}`]] : [[t("Problems"), "/problems"]]}
          actions={<>
            <Tags tags={p.tags} busy={edit.busy}
                  onChange={(tags) => edit.run(async () => set(await api.patch<Problem>(`/api/problems/${p.id}`, { tags })))} />
            {p.status === "ready" ? <Badge>{t("Ready · rubric v{n}", { n: p.rubric_version })}</Badge> : <Badge variant="outline">{t("Draft")}</Badge>}
          </>}>
      <ErrorText>{edit.error}</ErrorText>
      <nav aria-label={t("Problem screens")} className="flex gap-1 border-b">
        {tabs.map(([v, label]) => (
          <button key={v} type="button" aria-current={view === v ? "page" : undefined} onClick={() => go(v)}
                  className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                    view === v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </nav>
      {/* both stay mounted, so unsaved edits survive switching screens */}
      <div hidden={view !== "info"}><Sources p={p} onSaved={set} onGrader={() => go("grader")} /></div>
      <div hidden={view !== "grader"} className="space-y-8">
        <Grader p={p} onSaved={set} onInfo={() => go("info")} />
        {(p.status === "ready" || p.answers > 0) && (
          <section className="space-y-3">
            <Separator />
            <div>
              <h2 className="text-lg font-semibold">{t("Answers")}</h2>
              <p className="text-sm text-muted-foreground">{t("Add one answer per student (one or more pages). Grading only starts when you ask for it.")}</p>
            </div>
            <Answers problemId={p.id} ready={p.status === "ready"} />
          </section>
        )}
      </div>
    </Page>
  );
}

/** Uploaded statement or solution pages; a tap opens them large (PL-12, I4: the originals). */
/** PL-41: the problem's tags; the plus opens a field that suggests the teacher's other tags and takes new ones. */
function Tags({ tags, busy, onChange }: { tags: string[]; busy: boolean; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState<string | null>(null);  // null: the field is closed
  const [known, setKnown] = useState<string[]>([]);
  const has = (x: string) => tags.some((y) => y.toLowerCase() === x.toLowerCase());
  const open = () => { setText(""); api.get<string[]>("/api/problems/tags").then(setKnown, () => setKnown([])); };
  const add = (raw: string) => {
    const tag = raw.trim();
    if (tag && !has(tag)) onChange([...tags, tag]);
    setText("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((x) => (
        <Badge key={x} variant="secondary" className="gap-0.5 pr-0.5">
          {x}
          <button type="button" aria-label={t("Remove tag {tag}", { tag: x })} disabled={busy}
                  className="rounded-full p-0.5 hover:bg-background/60" onClick={() => onChange(tags.filter((y) => y !== x))}>
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      {text === null ? (
        <Button size="icon" variant="ghost" className="size-7" aria-label={t("Add tag")} title={t("Add tag")} onClick={open}>
          <Plus />
        </Button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); add(text); }}>
          <Input autoFocus list="problem-tags" maxLength={40} aria-label={t("Add tag")} placeholder={t("Tag name")}
                 className="h-7 w-40 text-sm" value={text}
                 onChange={(e) => {
                   // picking a suggestion adds it at once; typing a new name waits for Enter
                   const picked = !(e.nativeEvent instanceof InputEvent) || e.nativeEvent.inputType === "insertReplacementText";
                   if (picked && known.includes(e.target.value)) add(e.target.value);
                   else setText(e.target.value);
                 }}
                 onKeyDown={(e) => { if (e.key === "Escape") setText(null); }}
                 onBlur={() => { if (!text.trim()) setText(null); }} />
          <datalist id="problem-tags">
            {known.filter((x) => !has(x)).map((x) => <option key={x} value={x} />)}
          </datalist>
        </form>
      )}
    </div>
  );
}

function Thumbs({ files, onRemove, busy }: { files: ProblemFile[]; onRemove: (f: ProblemFile) => void; busy: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!files.length) return null;
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {files.map((x, i) => (
          <li key={x.link_id} className="relative">
            <button type="button" aria-label={t("Open {name}", { name: x.name })} onClick={() => setOpen(i)}
                    className="block overflow-hidden rounded border focus-visible:ring-2 focus-visible:ring-ring">
              <img src={fileUrl(x.id)} alt={x.name} className="h-24 object-cover" />
            </button>
            <button type="button" aria-label={t("Remove {name}", { name: x.name })} disabled={busy}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5" onClick={() => onRemove(x)}>
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={open !== null} onOpenChange={(o) => { if (!o) setOpen(null); }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogTitle>{t("Preview")}</DialogTitle>
          {open !== null && <ImageViewer key={open} pages={files} start={open} boxClass="h-[calc(var(--app-h)-12rem)]" />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** PL-15, PL-16 inputs (the title is edited in the page header): statement and solution as text and/or images, optional rubric. */
function Sources({ p, onSaved, onGrader }: { p: Problem; onSaved: (p: Problem) => void; onGrader: () => void }) {
  const [f, setF] = useState({ statement_text: p.statement_text, solution_text: p.solution_text, rubric_text: p.rubric_text });
  const act = useAction();
  const dirty = f.statement_text !== p.statement_text || f.solution_text !== p.solution_text || f.rubric_text !== p.rubric_text;
  const has = (role: "statement" | "solution") => !!f[`${role}_text`].trim() || p.files.some((x) => x.role === role);
  // pages go up as soon as they are dropped, picked or scanned: no extra step
  const upload = (role: "statement" | "solution", pages: UploadPage[]) => {
    if (pages.length) act.run(async () => onSaved(await api.form<Problem>(`/api/problems/${p.id}/files`, pagesForm(pages, { role }))));
  };
  const save = async () => { if (dirty) onSaved(await api.patch<Problem>(`/api/problems/${p.id}`, f)); };
  const prepare = () => act.run(async () => {
    await save();
    onSaved(await api.post<Problem>(`/api/problems/${p.id}/generate`));
    onGrader();
  });

  return (
    <div className="cols pt-2">
      <p className="col-full text-sm text-muted-foreground">{t("Type them, add images, or both. The AI reads all of it.")}</p>
      {(["statement", "solution"] as const).map((role) => (
        // the whole block is the drop area (PL-12); dropped images upload at once
        // rows (label, text, buttons + images) line up across the two blocks
        <Capture key={role} pages={[]} onChange={(v) => upload(role, v)} disabled={act.busy}
                 className="row-span-3 grid grid-rows-subgrid gap-2"
                 after={<Thumbs files={p.files.filter((x) => x.role === role)} busy={act.busy}
                                onRemove={(x) => act.run(async () => onSaved(await api.del<Problem>(`/api/problems/${p.id}/files/${x.link_id}`)))} />}>
            <Label htmlFor={role}>{role === "statement" ? t("Statement") : t("Reference solution")}</Label>
            <div className="relative flex flex-col">
              <Textarea id={role} rows={6} className="grow" value={f[`${role}_text`]} onChange={(e) => setF({ ...f, [`${role}_text`]: e.target.value })} />
              {!f[`${role}_text`] && (
                <p aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">
                  {t("Click to type or drag your images here")}
                </p>
              )}
            </div>
        </Capture>
      ))}
      <div className="col-full space-y-1.5">
        <Label htmlFor="rubric">{t("Your rubric (optional)")}</Label>
        <Textarea id="rubric" rows={3} placeholder={t("Leave empty and the AI proposes one.")} value={f.rubric_text} onChange={(e) => setF({ ...f, rubric_text: e.target.value })} />
      </div>
      <div className="col-full space-y-2">
      <ErrorText>{act.error}</ErrorText>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!dirty || act.busy} onClick={() => act.run(save)}>{t("Save")}</Button>
        {p.proposal ? (
          <Button onClick={onGrader}>{t("Go to the AI grader")} <ArrowRight /></Button>
        ) : (
          <Button disabled={!has("statement") || !has("solution") || act.busy} onClick={prepare}>
            {act.busy ? t("Preparing…") : t("Prepare the grader with AI")}
          </Button>
        )}
      </div>
      {!p.proposal && !(has("statement") && has("solution")) && (
        <p className="text-sm text-muted-foreground">{t("Add the statement and the reference solution first.")}</p>
      )}
      </div>
    </div>
  );
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function criterionErrors(c: Criterion, all: Criterion[]): string[] {
  const out = [];
  if (!c.id.trim()) out.push(t("needs an id"));
  if (all.filter((x) => x.id === c.id).length > 1) out.push(t("duplicate id"));
  if (!(c.max_points > 0)) out.push(t("points must be more than 0"));
  if (!c.description.trim()) out.push(t("needs a description"));
  return out;
}

/** PL-16 to PL-19: generate, edit every field, improve by instruction, accept a version. */
function Grader({ p, onSaved, onInfo }: { p: Problem; onSaved: (p: Problem) => void; onInfo: () => void }) {
  const [draft, setDraft] = useState<Proposal | null>(p.proposal);
  const [ack, setAck] = useState(false);
  const [instruction, setInstruction] = useState("");
  const act = useAction();
  useEffect(() => setDraft(p.proposal), [p.proposal]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(p.proposal);
  const has = (p.statement_text.trim() || p.files.some((f) => f.role === "statement")) && (p.solution_text.trim() || p.files.some((f) => f.role === "solution"));

  if (!draft) {
    return (
      <div className="space-y-3 pt-2">
        <p className="text-sm text-muted-foreground">{t("The AI reads the statement and the solution and proposes a rubric. You check and edit everything.")}</p>
        {!has && <p className="text-sm">{t("Add the statement and the reference solution first.")}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onInfo}>{t("Go to your information")}</Button>
          <Button disabled={!has || act.busy} onClick={() => act.run(async () => onSaved(await api.post<Problem>(`/api/problems/${p.id}/generate`)))}>
            {act.busy ? t("Preparing…") : t("Prepare the grader with AI")}
          </Button>
        </div>
        <ErrorText>{act.error}</ErrorText>
      </div>
    );
  }

  const d = draft;
  const up = (patch: Partial<Proposal>) => setDraft({ ...d, ...patch });
  const crit = d.rubric.criteria;
  const setCrit = (criteria: Criterion[]) => up({ rubric: { ...d.rubric, criteria } });
  const total = crit.reduce((s, c) => s + (Number(c.max_points) || 0), 0);

  return (
    <div className="space-y-8 pt-2">
      <p className="text-sm text-muted-foreground">{t("Every field is editable. Saving an edit to a ready problem makes it a draft; accepting creates the next rubric version, and earlier grades keep theirs.")}</p>
      {p.pending_proposal && (
        <Diff before={p.proposal!} after={p.pending_proposal} instruction={p.pending_instruction ?? ""} busy={act.busy}
              onChoose={(c) => act.run(async () => onSaved(await api.post<Problem>(`/api/problems/${p.id}/improve/${c}`)))} />
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("What the AI understood")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("Statement (as read)")}><Textarea rows={4} value={d.normalized_statement} onChange={(e) => up({ normalized_statement: e.target.value })} /></Field>
          <Field label={t("Solution (as read)")}><Textarea rows={4} value={d.normalized_solution} onChange={(e) => up({ normalized_solution: e.target.value })} /></Field>
          <ListField label={t("Final answers")} value={d.final_answers} onChange={(v) => up({ final_answers: v })} />
          <ListField label={t("Assumptions")} value={d.assumptions} onChange={(v) => up({ assumptions: v })} />
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox checked={d.diagram_required} onCheckedChange={(v) => up({ diagram_required: v === true })} /> {t("A diagram is required")}
            </label>
            {d.diagram_required && <ListField label={t("Expected forces")} value={d.expected_forces} onChange={(v) => up({ expected_forces: v })} />}
          </div>
          <ListField label={t("Grading plan")} value={d.grading_plan} onChange={(v) => up({ grading_plan: v })} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("Rubric · {n} points", { n: total })}</h2>
          <Button size="sm" variant="outline" onClick={() => setCrit([...crit, {
            id: `C${crit.length + 1}`, description: "", max_points: 1, required_evidence: "", full_credit: "", partial_credit: "", zero_credit: "",
          }])}><Plus /> {t("Criterion")}</Button>
        </div>
        <div className="cols">
        {crit.map((c, i) => {
          const errs = criterionErrors(c, crit);
          const edit = (patch: Partial<Criterion>) => setCrit(crit.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          const swap = (j: number) => { const n = [...crit]; [n[i], n[j]] = [n[j], n[i]]; setCrit(n); };
          return (
            // a subgrid: the header and each row of fields line up with the card beside it
            <Card key={i} className="row-span-5 grid grid-rows-subgrid gap-3 py-4 md:row-span-3">
              <CardHeader className="px-4">
                <div className="flex flex-wrap items-end gap-2">
                  <Field label={t("Id")} className="w-20"><Input value={c.id} onChange={(e) => edit({ id: e.target.value })} /></Field>
                  <Field label={t("Points")} className="w-24"><Input type="number" min={0} step={0.5} value={c.max_points} onChange={(e) => edit({ max_points: Number(e.target.value) })} /></Field>
                  <Field label={t("Description")} className="min-w-40 flex-1"><Input value={c.description} onChange={(e) => edit({ description: e.target.value })} /></Field>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label={t("Move up")} disabled={i === 0} onClick={() => swap(i - 1)}><ArrowUp /></Button>
                    <Button size="icon" variant="ghost" aria-label={t("Move down")} disabled={i === crit.length - 1} onClick={() => swap(i + 1)}><ArrowDown /></Button>
                    <Button size="icon" variant="ghost" aria-label={t("Remove {name}", { name: c.id })} onClick={() => setCrit(crit.filter((_, j) => j !== i))}><Trash2 /></Button>
                  </div>
                </div>
                {errs.length > 0 && <p className="text-sm text-destructive">{c.id || t("Criterion")}: {errs.join(", ")}</p>}
              </CardHeader>
              <CardContent className="row-span-4 grid grid-rows-subgrid gap-3 px-4 md:row-span-2 md:grid-cols-2">
                <Field label={t("Required evidence")}><Textarea rows={2} value={c.required_evidence} onChange={(e) => edit({ required_evidence: e.target.value })} /></Field>
                <Field label={t("Full credit")}><Textarea rows={2} value={c.full_credit} onChange={(e) => edit({ full_credit: e.target.value })} /></Field>
                <Field label={t("Partial credit")}><Textarea rows={2} value={c.partial_credit} onChange={(e) => edit({ partial_credit: e.target.value })} /></Field>
                <Field label={t("Zero credit")}><Textarea rows={2} value={c.zero_credit} onChange={(e) => edit({ zero_credit: e.target.value })} /></Field>
              </CardContent>
            </Card>
          );
        })}
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <Field label={t("Carried errors")}><Textarea rows={2} value={d.rubric.carried_error_policy} onChange={(e) => up({ rubric: { ...d.rubric, carried_error_policy: e.target.value } })} /></Field>
          <Field label={t("Tolerances")}><Textarea rows={2} value={d.rubric.tolerances} onChange={(e) => up({ rubric: { ...d.rubric, tolerances: e.target.value } })} /></Field>
          <Field label={t("Alternative methods")}><Textarea rows={2} value={d.rubric.alternative_methods} onChange={(e) => up({ rubric: { ...d.rubric, alternative_methods: e.target.value } })} /></Field>
        </div>
      </section>

      {d.issues.length > 0 && (
        <section className="space-y-2 rounded-lg border border-warning bg-warning/10 p-3">
          <h3 className="font-semibold">{t("Issues the AI found")}</h3>
          <ul className="list-disc pl-5 text-sm">{d.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} /> {t("I have read these issues")}</label>
        </section>
      )}
      <div className="space-y-2">
        {p.rubric_errors.length > 0 && !dirty && <ErrorText>{t("Fix the rubric: {errors}", { errors: p.rubric_errors.join("; ") })}</ErrorText>}
        <ErrorText>{act.error}</ErrorText>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!dirty || act.busy} onClick={() => act.run(async () => onSaved(await api.put<Problem>(`/api/problems/${p.id}/proposal`, { proposal: d })))}>{t("Save edits")}</Button>
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(p.proposal)}>{t("Undo edits")}</Button>
          <Button disabled={dirty || p.status === "ready" || act.busy || (d.issues.length > 0 && !ack)}
                  onClick={() => act.run(async () => onSaved(await api.post<Problem>(`/api/problems/${p.id}/accept`, { issues_acknowledged: ack })))}>
            {p.status === "ready" ? t("Accepted · v{n}", { n: p.rubric_version }) : t("Accept as rubric v{n}", { n: p.rubric_version + 1 })}
          </Button>
        </div>
      </div>

      <section className="space-y-2">
        <Separator className="mb-4" />
        <Label htmlFor="ins" className="text-lg font-semibold">{t("Improve with an instruction")}</Label>
        <Textarea id="ins" rows={2} placeholder={t("e.g. C2 should accept g = 9.8 or 10; the diagram needs friction")}
                  value={instruction} onChange={(e) => setInstruction(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!instruction.trim() || dirty || act.busy || !!p.pending_proposal}
                  onClick={() => act.run(async () => { onSaved(await api.post<Problem>(`/api/problems/${p.id}/improve`, { instruction })); setInstruction(""); })}>
            {act.busy ? t("Asking the AI…") : t("Ask the AI to revise")}
          </Button>
          <Button variant="ghost" disabled={act.busy} onClick={() => { if (confirm(t("Replace the whole proposal with a fresh one from the AI?"))) act.run(async () => onSaved(await api.post<Problem>(`/api/problems/${p.id}/generate`))); }}>
            {t("Prepare again from scratch")}
          </Button>
        </div>
        {dirty && <p className="text-xs text-muted-foreground">{t("Save or undo your edits before asking the AI.")}</p>}
      </section>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  // the text field fills the cell, so fields side by side share the tallest one's height
  return <label className={cn("flex flex-col gap-1 [&>textarea]:grow", className)}><span className="text-sm font-medium">{label}</span>{children}</label>;
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join("\n"));
  useEffect(() => { if (lines(text).join("\n") !== value.join("\n")) setText(value.join("\n")); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Field label={t("{label} (one per line)", { label })}>
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
      <h3 className="font-semibold">{t("Revised by the AI: “{instruction}”", { instruction })}</h3>
      {keys.length === 0 ? <p className="text-sm text-muted-foreground">{t("The AI changed nothing.")}</p> : (
        <ul className="space-y-2 text-sm">
          {keys.map((k) => (
            <li key={k} className="rounded bg-muted p-2">
              <div className="text-xs font-medium text-muted-foreground">{k.replaceAll("_", " ")}</div>
              {a[k] !== undefined && <div className="text-destructive line-through">{a[k] || t("(empty)")}</div>}
              {b[k] !== undefined && <div className="text-success">{b[k] || t("(empty)")}</div>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => onChoose("keep")}>{t("Keep the revision")}</Button>
        <Button variant="outline" disabled={busy} onClick={() => onChoose("discard")}>{t("Discard it")}</Button>
      </div>
    </section>
  );
}

