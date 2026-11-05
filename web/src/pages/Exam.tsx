import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowDown, ArrowUp, Copy, Maximize2, X } from "lucide-react";
import { AnswerTable } from "@/components/Answers";
import Capture from "@/components/Capture";
import { ErrorText, Page, useAction, useLoad, when } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/lib/i18n";
import { api, pagesForm, type AnswerRow, type Exam, type Group, type Link, type Page as UploadPage } from "@/lib/api";
import { navigate, query } from "@/lib/router";
import { cn } from "@/lib/utils";

type ProblemRow = { id: string; title: string; status: string };

/** PL-26 to PL-28, PL-30: an exam's problems and groups, answers per group, upload links. */
export default function ExamPage({ id }: { id: string }) {
  const exam = useLoad(() => api.get<Exam>(`/api/exams/${id}`), [id]);
  const problems = useLoad(() => api.get<ProblemRow[]>("/api/problems"), []);
  const groups = useLoad(() => api.get<Group[]>("/api/groups"), []);
  const [group, setGroup] = useState<string | null>(query("group"));
  const act = useAction();
  const e = exam.data;
  useEffect(() => { if (e && (!group || !e.groups.some((g) => g.id === group))) setGroup(e.groups[0]?.id ?? null); }, [e, group]);
  if (!e) return <Page title={t("Exam")} crumbs={[[t("Exams"), "/exams"]]}><ErrorText>{exam.error}</ErrorText></Page>;
  const save = (fn: () => Promise<Exam>) => act.run(async () => exam.setData(await fn()));

  return (
    <Page title={e.title} crumbs={[[t("Exams"), "/exams"]]}
          actions={<Button size="sm" variant="outline" onClick={() => { const name = prompt(t("Exam title"), e.title); if (name?.trim()) save(() => api.patch(`/api/exams/${id}`, { title: name })); }}>{t("Rename")}</Button>}>
      <ErrorText>{act.error}</ErrorText>
      <div className="grid gap-4 md:grid-cols-2">
        <ExamProblems e={e} all={problems.data ?? []} save={save} busy={act.busy} />
        <Card>
          <CardHeader><CardTitle>{t("Groups taking this exam")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {groups.data?.filter((g) => !g.archived || e.groups.some((x) => x.id === g.id)).map((g) => {
              const on = e.groups.some((x) => x.id === g.id);
              return (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={on} disabled={act.busy}
                         onChange={() => save(() => api.put(`/api/exams/${id}/groups`, { group_ids: on ? e.groups.filter((x) => x.id !== g.id).map((x) => x.id) : [...e.groups.map((x) => x.id), g.id] }))} />
                  {g.name}
                </label>
              );
            })}
            {groups.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("Create a group in the Groups tab first.")}</p>}
          </CardContent>
        </Card>
      </div>
      {e.groups.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-1 overflow-x-auto border-b" role="tablist">
            {e.groups.map((g) => (
              <button key={g.id} role="tab" aria-selected={g.id === group} onClick={() => setGroup(g.id)}
                      className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", g.id === group ? "border-primary" : "border-transparent text-muted-foreground")}>
                {g.name}
              </button>
            ))}
          </div>
          {group && <ExamGroup key={group} e={e} groupId={group} />}
        </div>
      )}
    </Page>
  );
}

function ExamProblems({ e, all, save, busy }: { e: Exam; all: ProblemRow[]; save: (fn: () => Promise<Exam>) => void; busy: boolean }) {
  const [pick, setPick] = useState("");
  const [title, setTitle] = useState("");
  const ids = e.problems.map((p) => p.id);
  const others = all.filter((p) => !ids.includes(p.id));
  const move = (i: number, j: number) => { const n = [...ids]; [n[i], n[j]] = [n[j], n[i]]; save(() => api.put(`/api/exams/${e.id}/problems`, { problem_ids: n })); };
  return (
    <Card>
      <CardHeader><CardTitle>{t("Problems")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-1">
          {e.problems.map((p, i) => (
            <li key={p.id} className="flex items-center gap-1 text-sm">
              <span className="w-5 text-muted-foreground">{i + 1}.</span>
              <a href={`/problems/${p.id}?exam=${e.id}`} onClick={(ev) => { ev.preventDefault(); navigate(`/problems/${p.id}?exam=${e.id}`); }} className="min-w-0 flex-1 truncate hover:underline">{p.title}</a>
              {p.status === "ready" ? <Badge>{t("Ready")}</Badge> : <Badge variant="outline">{t("Draft")}</Badge>}
              <Button size="icon" variant="ghost" aria-label={t("Move up")} disabled={i === 0 || busy} onClick={() => move(i, i - 1)}><ArrowUp /></Button>
              <Button size="icon" variant="ghost" aria-label={t("Move down")} disabled={i === ids.length - 1 || busy} onClick={() => move(i, i + 1)}><ArrowDown /></Button>
              <Button size="icon" variant="ghost" aria-label={t("Remove {title}", { title: p.title })} disabled={busy} onClick={() => save(() => api.del(`/api/exams/${e.id}/problems/${p.id}`))}><X /></Button>
            </li>
          ))}
          {e.problems.length === 0 && <li className="text-sm text-muted-foreground">{t("No problems yet.")}</li>}
        </ol>
        {others.length > 0 && (
          <div className="flex gap-2">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger className="min-w-0 flex-1" aria-label={t("Existing problem")}><SelectValue placeholder={t("Add an existing problem")} /></SelectTrigger>
              <SelectContent>{others.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" disabled={!pick || busy} onClick={() => { save(() => api.post(`/api/exams/${e.id}/problems`, { problem_id: pick })); setPick(""); }}>{t("Add")}</Button>
          </div>
        )}
        <form className="flex gap-2" onSubmit={(ev) => {
          ev.preventDefault();
          save(async () => { const out = await api.post<Exam & { created_problem_id: string }>(`/api/exams/${e.id}/problems/new`, { title }); setTitle(""); return out; });
        }}>
          <Input placeholder={t("Or create a new problem")} value={title} onChange={(ev) => setTitle(ev.target.value)} aria-label={t("New problem title")} />
          <Button type="submit" variant="outline" disabled={!title.trim() || busy}>{t("Create")}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** One exam and group: upload links with QR codes, answers per problem and student, teacher uploads. */
function ExamGroup({ e, groupId }: { e: Exam; groupId: string }) {
  const answers = useLoad(() => api.get<{ answers: AnswerRow[] }>(`/api/exams/${e.id}/groups/${groupId}/answers`).then((r) => r.answers), [e.id, groupId]);
  const [problem, setProblem] = useState<string>("all");
  const title = (pid: string) => e.problems.find((p) => p.id === pid)?.title ?? "";
  const rows = (answers.data ?? []).filter((r) => problem === "all" || r.problem_id === problem);
  const ready = e.problems.every((p) => p.status === "ready");
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>{t("Answers")}</CardTitle>
          <CardDescription>{t("Students' uploads arrive here. Nothing is graded until you start it.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={problem} onValueChange={setProblem}>
            <SelectTrigger className="w-full sm:w-72" aria-label={t("Filter by problem")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("All problems")}</SelectItem>
              {e.problems.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
          {!ready && <p className="text-sm text-muted-foreground">{t("Some problems are drafts: accept their graders before grading.")}</p>}
          <ErrorText>{answers.error}</ErrorText>
          {answers.data && <AnswerTable rows={rows} reload={answers.reload} ctx={`exam:${e.id}:${groupId}`} canGrade={ready} problemTitle={title} />}
          <TeacherUpload e={e} groupId={groupId} onDone={answers.reload} />
        </CardContent>
      </Card>
      <Links e={e} groupId={groupId} />
    </div>
  );
}

function TeacherUpload({ e, groupId, onDone }: { e: Exam; groupId: string; onDone: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<UploadPage[]>([]);
  const [name, setName] = useState("");
  const [pid, setPid] = useState("");
  const act = useAction();
  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}>{t("Upload for a student")}</Button>;
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <h3 className="text-sm font-semibold">{t("Upload on a student's behalf")}</h3>
      <div className="flex flex-wrap gap-2">
        <Input className="w-full sm:w-56" placeholder={t("Student name")} value={name} onChange={(ev) => setName(ev.target.value)} aria-label={t("Student name")} />
        <Select value={pid} onValueChange={setPid}>
          <SelectTrigger className="w-full sm:w-56" aria-label={t("Problem")}><SelectValue placeholder={t("Problem")} /></SelectTrigger>
          <SelectContent>{e.problems.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Capture pages={pages} onChange={setPages} label="answer pages" />
      <ErrorText>{act.error}</ErrorText>
      <div className="flex gap-2">
        <Button disabled={!pages.length || !name.trim() || !pid || act.busy} onClick={() => act.run(async () => {
          await api.form(`/api/problems/${pid}/answers`, pagesForm(pages, { student_name: name, exam_id: e.id, group_id: groupId }));
          setPages([]); setName(""); await onDone();
        })}>{t("Upload")}</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>{t("Close")}</Button>
      </div>
    </div>
  );
}

function Links({ e, groupId }: { e: Exam; groupId: string }) {
  const links = useLoad(() => api.get<Link[]>(`/api/exams/${e.id}/groups/${groupId}/links`), [e.id, groupId]);
  const prefs = useLoad(() => api.get<{ link_minutes: number }>("/api/settings"), []);
  const [minutes, setMinutes] = useState("");
  const [big, setBig] = useState(false);
  const [now, setNow] = useState(Date.now());
  const act = useAction();
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, []);
  const open = links.data?.find((l) => l.state === "open" && new Date(l.expires_at).getTime() > now);
  const left = open ? Math.max(0, Math.round((new Date(open.expires_at).getTime() - now) / 1000)) : 0;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("Student upload link")}</CardTitle>
        <CardDescription>{t("Show the QR code in class. Students type their name and upload their own answers.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {open ? (
          <div className="space-y-2 text-center">
            <button className="mx-auto block rounded-lg bg-white p-3" aria-label={t("Show the QR code full screen")} onClick={() => setBig(true)}>
              <QRCodeSVG value={open.url} size={200} />
            </button>
            <p className="break-all text-xs"><a className="underline" href={open.url} target="_blank" rel="noreferrer">{open.url}</a></p>
            <p className="text-sm font-medium tabular-nums">{t("Closes in {time}", { time: clock })}</p>
            <div className="flex justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(open.url)}><Copy /> {t("Copy")}</Button>
              <Button size="sm" variant="outline" onClick={() => setBig(true)}><Maximize2 /> {t("Full screen")}</Button>
              <Button size="sm" variant="destructive" disabled={act.busy} onClick={() => act.run(async () => { await api.post(`/api/links/${open.id}/close`); await links.reload(); })}>{t("Close now")}</Button>
            </div>
          </div>
        ) : (
          <form className="flex flex-wrap items-end gap-2" onSubmit={(ev) => {
            ev.preventDefault();
            act.run(async () => { await api.post(`/api/exams/${e.id}/groups/${groupId}/links`, { minutes: minutes ? Number(minutes) : null }); await links.reload(); });
          }}>
            <label className="space-y-1 text-sm">
              <span>{t("Open for (minutes)")}</span>
              <Input type="number" min={1} max={240} className="w-24" placeholder={String(prefs.data?.link_minutes ?? 10)} value={minutes} onChange={(ev) => setMinutes(ev.target.value)} />
            </label>
            <Button type="submit" disabled={act.busy || e.problems.length === 0}>{t("Open a link")}</Button>
          </form>
        )}
        <ErrorText>{act.error ?? links.error}</ErrorText>
        {links.data && links.data.length > 0 && (
          <ul className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
            {links.data.slice(0, 6).map((l) => (
              <li key={l.id} className="flex justify-between gap-2">
                <span>{when(l.created_at)}</span>
                <span>{t(l.state === "open" && new Date(l.expires_at).getTime() <= now ? "expired" : l.state)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {big && open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white p-4 text-black" onClick={() => setBig(false)}>
          <p className="text-xl font-semibold">{e.title}</p>
          <QRCodeSVG value={open.url} size={Math.min(innerWidth, innerHeight) * 0.7} />
          <p className="break-all text-center text-lg">{open.url}</p>
          <p className="text-lg tabular-nums">{t("Closes in {time} · tap to close", { time: clock })}</p>
        </div>
      )}
    </Card>
  );
}
