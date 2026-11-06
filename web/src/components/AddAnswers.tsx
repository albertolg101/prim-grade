import { useRef, useState } from "react";
import { FolderOpen, Plus, X } from "lucide-react";
import Capture, { OK } from "@/components/Capture";
import { ErrorText, useAction } from "@/components/common";
import TagInput from "@/components/TagInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, pagesForm, type Group, type Page } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Student = { key: string; name: string; pages: Page[] };
const path = (f: File) => f.webkitRelativePath || f.name;

/** PL-50: a chosen folder as answers. An image at the top of the folder is one student, named after the
 * file; a subfolder (with everything below it) is one student, named after it, its pages in file-name
 * order. Hidden files are ignored; other files are skipped and named. */
export function studentsInFolder(files: File[]): { students: Student[]; skipped: string[] } {
  const by = new Map<string, Student>();
  const skipped: string[] = [];
  const sorted = [...files].sort((a, b) => path(a).localeCompare(path(b), undefined, { numeric: true }));
  for (const f of sorted) {
    const parts = path(f).split("/").slice(1);  // drop the chosen folder itself
    if (!parts.length || parts.some((p) => p.startsWith("."))) continue;
    if (!OK.includes(f.type)) { skipped.push(parts.join("/")); continue; }
    const own = parts.length === 1;
    const key = own ? `file:${parts[0]}` : `dir:${parts[0]}`;
    const s = by.get(key) ?? { key, name: own ? parts[0].replace(/\.[^.]+$/, "") : parts[0], pages: [] };
    s.pages.push({ file: f, name: f.name, preview: "" });
    by.set(key, s);
  }
  return { students: [...by.values()], skipped };
}

/** PL-20, PL-50: the "Add answer(s)" button and its dialog, for one student or a folder of students. */
export default function AddAnswers({ problemId, groups, group, onGroup, onAdded, lockGroup, trigger }: {
  problemId: string; groups: Group[]; group: Group | null; onGroup: (g: Group | null) => void; onAdded: () => Promise<unknown>;
  lockGroup?: boolean;  // PL-51: on a group's page the group is that group
  trigger?: string;  // the button's text when it should say more than "Add answer(s)"
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"one" | "folder">("one");
  const [pages, setPages] = useState<Page[]>([]);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [sent, setSent] = useState(0);
  const folder = useRef<HTMLInputElement>(null);
  const act = useAction();
  const url = `/api/problems/${problemId}/answers`;
  const extra = { label, group_id: group?.id };  // the group stays for next time: answers often come by group

  const reset = () => { setPages([]); setName(""); setLabel(""); setStudents([]); setSkipped([]); setSent(0); act.setError(null); };
  const close = (next: boolean) => { if (act.busy) return; setOpen(next); if (!next) reset(); };
  const addOne = () => act.run(async () => {
    await api.form(url, pagesForm(pages, { ...extra, student_name: name }));
    await onAdded();
    close(false);
  });
  // one request per student, in order; a failure stops there and keeps the rest listed to retry
  const addFolder = () => act.run(async () => {
    try {
      for (const s of students) {
        await api.form(url, pagesForm(s.pages, { ...extra, student_name: s.name.trim() }));
        setStudents((list) => list.filter((x) => x.key !== s.key));
        setSent((n) => n + 1);
      }
    } finally {
      await onAdded();
    }
    setOpen(false); reset();
  });
  const pick = (files: FileList | null) => {
    const found = studentsInFolder(Array.from(files ?? []));
    setStudents(found.students); setSkipped(found.skipped); setSent(0); act.setError(null);
  };
  const total = students.reduce((n, s) => n + s.pages.length, 0);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} aria-label={trigger}><Plus /> {t("Add answer(s)")}</Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("Add answer(s)")}</DialogTitle>
            <DialogDescription>{t("One answer per student (one or more pages). Grading only starts when you ask for it.")}</DialogDescription>
          </DialogHeader>
          <nav className="flex gap-1 border-b" aria-label={t("How to add")}>
            {([["one", t("One student")], ["folder", t("Folder of students")]] as const).map(([m, text]) => (
              <button key={m} type="button" aria-pressed={mode === m} disabled={act.busy} onClick={() => { setMode(m); act.setError(null); }}
                      className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                        mode === m ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {text}
              </button>
            ))}
          </nav>
          {mode === "one" ? (
            <div className="min-w-0 space-y-3">
              <Capture pages={pages} onChange={setPages} label={t("answer pages")} />
              <Input placeholder={t("Student name (optional)")} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("Student name")} />
            </div>
          ) : (
            <div className="min-w-0 space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("Images directly in the folder are one student each, named after the file. A folder inside it is one student, named after the folder, with its images as pages in name order.")}
              </p>
              <div>
                <Button type="button" variant="outline" disabled={act.busy} onClick={() => folder.current?.click()}><FolderOpen /> {t("Choose a folder")}</Button>
                <input ref={folder} type="file" hidden multiple {...{ webkitdirectory: "" }}
                       onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
              </div>
              {skipped.length > 0 && (
                <p className="text-sm text-destructive">{t("Skipped (use JPG, PNG or WebP): {files}", { files: skipped.join(", ") })}</p>
              )}
              {sent > 0 && <p className="text-sm text-muted-foreground" aria-live="polite">{t("{n} added", { n: sent })}</p>}
              {students.length > 0 && (<>
                <p className="text-xs text-muted-foreground">{t("{n} students, {pages} pages. Check the names before adding.", { n: students.length, pages: total })}</p>
                <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
                  {students.map((s) => (
                    <li key={s.key} className="flex items-center gap-2 px-2 py-1.5">
                      <Input className="h-8 min-w-0 flex-1" value={s.name} aria-label={t("Student name")} disabled={act.busy}
                             onChange={(e) => setStudents(students.map((x) => x.key === s.key ? { ...x, name: e.target.value } : x))} />
                      <span className="shrink-0 text-xs text-muted-foreground" title={s.pages.map((p) => p.name).join(", ")}>
                        {s.pages.length === 1 ? t("1 page") : t("{n} pages", { n: s.pages.length })}
                      </span>
                      <button type="button" aria-label={t("Remove {name}", { name: s.name })} disabled={act.busy}
                              className="rounded-full p-1 text-muted-foreground hover:bg-accent" onClick={() => setStudents(students.filter((x) => x.key !== s.key))}>
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>)}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder={t("Label (optional)")} value={label} onChange={(e) => setLabel(e.target.value)} aria-label={t("Label")} />
            <GroupPick groups={groups.filter((g) => !g.archived)} value={group} onChange={onGroup} locked={lockGroup} />
          </div>
          <ErrorText>{act.error}</ErrorText>
          <DialogFooter>
            <Button variant="outline" disabled={act.busy} onClick={() => close(false)}>{t("Cancel")}</Button>
            {mode === "one" ? (
              <Button disabled={!pages.length || act.busy} onClick={addOne}>
                {pages.length === 1 ? t("Add answer (1 page)") : t("Add answer ({n} pages)", { n: pages.length })}
              </Button>
            ) : (
              <Button disabled={!students.length || act.busy || students.some((s) => !s.name.trim())} onClick={addFolder}>
                {act.busy ? t("Adding… {done} of {total}", { done: sent, total: sent + students.length })
                  : !students.length ? t("Add answer(s)") : students.length === 1 ? t("Add 1 answer") : t("Add {n} answers", { n: students.length })}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** PL-46: an optional group, picked from the teacher's groups with an autocomplete; once picked it
 * shows as a chip that can be removed. */
export function GroupPick({ groups, value, onChange, locked }: { groups: Group[]; value: Group | null; onChange: (g: Group | null) => void; locked?: boolean }) {
  if (value) {
    return (
      <div className="flex h-9 items-center justify-between gap-2 rounded-md border px-3 text-sm">
        <span className="min-w-0 truncate" title={value.name}>{value.name}</span>
        {!locked && <button type="button" aria-label={t("Remove group {name}", { name: value.name })} className="rounded-full p-0.5 hover:bg-accent"
                onClick={() => onChange(null)}><X className="size-3.5" /></button>}
      </div>
    );
  }
  if (!groups.length) return <Input disabled placeholder={t("No groups yet")} aria-label={t("Group")} />;
  return (
    <TagInput inputClassName="h-9" label={t("Group")} placeholder={t("Group (optional)")}
              noMatch="No group matches “{q}”." suggestions={groups.map((g) => ({ value: g.name }))}
              onPick={(name) => onChange(groups.find((g) => g.name === name) ?? null)} />
  );
}
