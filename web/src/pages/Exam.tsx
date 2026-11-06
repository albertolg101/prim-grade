import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Copy, Download, Maximize2, X } from "lucide-react";
import { AnswerTable } from "@/components/Answers";
import Capture from "@/components/Capture";
import { ErrorText, Page, useAction, useLoad, when } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TagInput from "@/components/TagInput";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/lib/i18n";
import { api, pagesForm, type AnswerRow, type Exam, type Group, type Link, type Page as UploadPage } from "@/lib/api";
import { navigate, query } from "@/lib/router";
import { cn } from "@/lib/utils";

type ProblemRow = { id: string; title: string; status: string; archived: boolean };

/** PL-26 to PL-28, PL-30: an exam's problems and groups, answers per group, upload links. */
export default function ExamPage({ id }: { id: string }) {
  const exam = useLoad(() => api.get<Exam>(`/api/exams/${id}`), [id]);
  useEffect(() => { void api.post(`/api/exams/${id}/opened`); }, [id]);  // PL-56: now recently used
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
          onRename={(title) => save(() => api.patch(`/api/exams/${id}`, { title }))}
          actions={<>
            {e.archived && <Badge variant="secondary">{t("Archived")}</Badge>}
            <ExportMarks id={id} />
          </>}>
      {/* PL-56: like a group (PL-51): reversible, its answers, groups and links are kept */}
      <Button variant="ghost" size="sm" className="-mt-3 -ml-2 h-7 self-start px-2 text-xs font-normal text-muted-foreground" disabled={act.busy}
              onClick={() => save(() => api.patch(`/api/exams/${id}`, { archived: !e.archived }))}>
        {e.archived ? <><ArchiveRestore /> {t("Unarchive")}</> : <><Archive /> {t("Archive")}</>}
      </Button>
      <ErrorText>{act.error}</ErrorText>
      <ExamProblems e={e} all={problems.data ?? []} save={save} busy={act.busy} />
      <ExamGroups e={e} all={groups.data ?? []} save={save} busy={act.busy} />
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
          {group && <ExamGroup key={group} e={e} groupId={group} onUploads={exam.reload} />}
        </div>
      )}
    </Page>
  );
}

/** PL-26, PL-55: the exam's problems in order. Once in the exam a problem stays: it is switched off
 * (students' links no longer offer it, its answers stay) instead of removed. */
function ExamProblems({ e, all, save, busy }: { e: Exam; all: ProblemRow[]; save: (fn: () => Promise<Exam>) => void; busy: boolean }) {
  const ids = e.problems.map((p) => p.id);
  const others = all.filter((p) => !ids.includes(p.id) && !p.archived);  // PL-44
  const move = (i: number, j: number) => { const n = [...ids]; [n[i], n[j]] = [n[j], n[i]]; save(() => api.put(`/api/exams/${e.id}/problems`, { problem_ids: n })); };
  return (
    <Card>
      <CardHeader><CardTitle>{t("Problems")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-1">
          {e.problems.map((p, i) => (
            <li key={p.id} className="flex items-center gap-1 text-sm">
              <span className="w-5 text-muted-foreground">{i + 1}.</span>
              <a href={`/problems/${p.id}?exam=${e.id}`} onClick={(ev) => { ev.preventDefault(); navigate(`/problems/${p.id}?exam=${e.id}`); }}
                 className={cn("min-w-0 flex-1 truncate hover:underline", !p.active && "text-muted-foreground line-through")}>{p.title}</a>
              {p.status === "ready" ? <Badge>{t("Ready")}</Badge> : <Badge variant="outline">{t("Draft")}</Badge>}
              <label className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground" title={t("Students can pick it on the upload link")}>
                <Checkbox checked={p.active} disabled={busy} aria-label={t("{title} active", { title: p.title })}
                          onCheckedChange={(on) => save(() => api.patch(`/api/exams/${e.id}/problems/${p.id}`, { active: on === true }))} />
                {t("Active")}
              </label>
              <Button size="icon" variant="ghost" aria-label={t("Move up")} disabled={i === 0 || busy} onClick={() => move(i, i - 1)}><ArrowUp /></Button>
              <Button size="icon" variant="ghost" aria-label={t("Move down")} disabled={i === ids.length - 1 || busy} onClick={() => move(i, i + 1)}><ArrowDown /></Button>
            </li>
          ))}
          {e.problems.length === 0 && <li className="text-sm text-muted-foreground">{t("No problems yet.")}</li>}
        </ol>
        {others.length > 0 && (
          <TagInput label={t("Add a problem")} placeholder={t("Type a problem name…")} noMatch="No problem matches “{q}”."
                    suggestions={others.map((p) => ({ value: p.title }))}
                    onPick={(name) => { const p = others.find((x) => x.title === name); if (p) save(() => api.post(`/api/exams/${e.id}/problems`, { problem_id: p.id })); }} />
        )}
      </CardContent>
    </Card>
  );
}

/** PL-27, PL-55: the groups taking the exam, added with an autocomplete; per group, how many students
 * uploaded an answer, in all and per problem. A group with answers stays in the exam. */
function ExamGroups({ e, all, save, busy }: { e: Exam; all: Group[]; save: (fn: () => Promise<Exam>) => void; busy: boolean }) {
  const ids = e.groups.map((g) => g.id);
  const others = all.filter((g) => !g.archived && !ids.includes(g.id))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));  // the newest first, like the answer filters
  const put = (next: string[]) => save(() => api.put(`/api/exams/${e.id}/groups`, { group_ids: next }));
  return (
    <Card>
      <CardHeader><CardTitle>{t("Groups taking this exam")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {e.groups.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("Group")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Students")}</th>
                  {e.problems.map((p, i) => (
                    <th key={p.id} className={cn("px-3 py-2 text-right font-medium", !p.active && "line-through")} title={p.title}>{i + 1}</th>
                  ))}
                  <th className="w-10"><span className="sr-only">{t("Remove")}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {e.groups.map((g) => (
                  <tr key={g.id}>
                    <td className="max-w-48 truncate px-3 py-2 font-medium" title={g.name}>{g.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{g.students}</td>
                    {e.problems.map((p) => (
                      <td key={p.id} className="px-3 py-2 text-right tabular-nums text-muted-foreground">{g.per_problem[p.id] ?? 0}</td>
                    ))}
                    <td className="px-1 text-right">
                      {g.students === 0 && (  // a group with answers stays (the server refuses too)
                        <Button size="icon" variant="ghost" className="size-7" disabled={busy} aria-label={t("Remove group {name}", { name: g.name })}
                                onClick={() => put(ids.filter((x) => x !== g.id))}><X /></Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {e.groups.length > 0 && e.problems.length > 0 && (
          <p className="text-xs text-muted-foreground">{t("Students who uploaded an answer, in all and per problem (by its number).")}</p>
        )}
        {all.length === 0 ? <p className="text-sm text-muted-foreground">{t("Create a group in the Groups tab first.")}</p>
          : others.length > 0 && (
            <TagInput label={t("Add a group")} placeholder={t("Type a group…")} noMatch="No group matches “{q}”."
                      suggestions={others.map((g) => ({ value: g.name }))}
                      onPick={(name) => { const g = others.find((x) => x.name === name); if (g) put([...ids, g.id]); }} />
          )}
      </CardContent>
    </Card>
  );
}

/** One exam and group: upload links with QR codes, answers per problem and student, teacher uploads. */
function ExamGroup({ e, groupId, onUploads }: { e: Exam; groupId: string; onUploads: () => Promise<unknown> }) {
  const answers = useLoad(() => api.get<{ answers: AnswerRow[] }>(`/api/exams/${e.id}/groups/${groupId}/answers`).then((r) => r.answers), [e.id, groupId]);
  const { reload } = answers;
  // PL-27: students upload while this page is on screen, so their answers (and the group counts) show up by themselves
  // ponytail: polls every 5 s while the tab is visible; push updates if many teachers watch at once
  useEffect(() => {
    const tick = setInterval(() => { if (!document.hidden) { reload(); onUploads(); } }, 5000);
    return () => clearInterval(tick);
  }, [reload, onUploads]);
  const title = (pid: string) => e.problems.find((p) => p.id === pid)?.title ?? "";
  const ready = e.problems.every((p) => p.status === "ready");
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>{t("Answers")}</CardTitle>
          <CardDescription>{t("Students' uploads arrive here. Nothing is graded until you start it.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!ready && <p className="text-sm text-muted-foreground">{t("Some problems are drafts: accept their graders before grading.")}</p>}
          <ErrorText>{answers.error}</ErrorText>
          {answers.data && <AnswerTable rows={answers.data} reload={answers.reload} ctx={`exam:${e.id}:${groupId}`} canGrade={ready} problemTitle={title} />}
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
          <form className="space-y-1.5" onSubmit={(ev) => {
            ev.preventDefault();
            act.run(async () => { await api.post(`/api/exams/${e.id}/groups/${groupId}/links`, { minutes: minutes ? Number(minutes) : null }); await links.reload(); });
          }}>
            <Label htmlFor="link-minutes">{t("Open for")}</Label>
            <div className="flex gap-2">
              {/* the minutes and their unit read as one field, level with the button */}
              <div className="relative w-28 shrink-0">
                <Input id="link-minutes" type="number" inputMode="numeric" min={1} max={240}
                       className="pr-11 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                       placeholder={String(prefs.data?.link_minutes ?? 10)} value={minutes} onChange={(ev) => setMinutes(ev.target.value)} />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{t("min")}</span>
              </div>
              <Button type="submit" className="flex-1" disabled={act.busy || !e.problems.some((p) => p.active)}>{t("Open a link")}</Button>
            </div>
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

type Format = "xlsx" | "csv";

/** PL-58, PL-61: approved marks only, one row per student, in the teacher's default format or the
 * one picked here. */
function ExportMarks({ id }: { id: string }) {
  const prefs = useLoad(() => api.get<{ export_format: Format }>("/api/settings"), []);
  const [picked, setPicked] = useState<Format | null>(null);
  const fmt = picked ?? prefs.data?.export_format ?? "xlsx";
  return (
    <div className="flex">
      <Button asChild variant="outline" size="sm" className="rounded-r-none">
        <a href={`/api/exams/${id}/export.${fmt}`} download><Download /> {t("Export marks")}</a>
      </Button>
      <Select value={fmt} onValueChange={(v) => setPicked(v as Format)}>
        <SelectTrigger size="sm" className="rounded-l-none border-l-0" aria-label={t("Export format")}><SelectValue /></SelectTrigger>
        <SelectContent position="popper" align="end">
          <SelectItem value="xlsx">Excel</SelectItem>
          <SelectItem value="csv">CSV</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
