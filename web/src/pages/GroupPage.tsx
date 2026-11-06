import { Archive, ArchiveRestore, Sparkles } from "lucide-react";
import AddAnswers from "@/components/AddAnswers";
import { ErrorText, Page, useAction, useLoad, when } from "@/components/common";
import ProblemBrowser from "@/components/ProblemBrowser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, type GroupDetail } from "@/lib/api";
import { t } from "@/lib/i18n";
import { navigate } from "@/lib/router";

/** PL-51: one group: its exams, then its problems with the problem filters, each with Add answer(s) and Grade. */
export default function GroupPage({ id }: { id: string }) {
  const group = useLoad(() => api.get<GroupDetail>(`/api/groups/${id}`), [id]);
  const tags = useLoad(() => api.get<string[]>("/api/problems/tags"), []);
  const edit = useAction();
  const grade = useAction();
  const g = group.data;
  if (!g) return <Page title={t("Group")} crumbs={[[t("Groups"), "/groups"]]}><ErrorText>{group.error}</ErrorText></Page>;
  const patch = (body: object) => edit.run(async () => { await api.patch(`/api/groups/${g.id}`, body); await group.reload(); });

  return (
    <Page title={g.name} crumbs={[[t("Groups"), "/groups"]]} onRename={(name) => patch({ name })}
          actions={g.archived && <Badge variant="secondary">{t("Archived")}</Badge>}>
      {/* like a problem (PL-44): reversible, its answers and exams are kept */}
      <Button variant="ghost" size="sm" className="-mt-3 -ml-2 h-7 self-start px-2 text-xs font-normal text-muted-foreground" disabled={edit.busy}
              onClick={() => patch({ archived: !g.archived })}>
        {g.archived ? <><ArchiveRestore /> {t("Unarchive")}</> : <><Archive /> {t("Archive")}</>}
      </Button>
      <ErrorText>{group.error ?? edit.error ?? grade.error}</ErrorText>
      <p className="text-sm text-muted-foreground">
        {g.students.length ? t("Students who have submitted ({n}): {names}", { n: g.students.length, names: g.students.join(", ") }) : t("No submissions yet.")}
      </p>

      <section aria-labelledby="group-exams" className="space-y-2">
        <h2 id="group-exams" className="text-sm font-semibold">{t("Exams")}</h2>
        {g.exams.length === 0 ? <p className="text-sm text-muted-foreground">{t("No exam is given to this group yet. Assign it from an exam.")}</p> : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]">
            {g.exams.map((e) => (
              <li key={e.id}>
                <a href={`/exams/${e.id}?group=${g.id}`} onClick={(ev) => { ev.preventDefault(); navigate(`/exams/${e.id}?group=${g.id}`); }}
                   className="flex h-full flex-col gap-1 rounded-lg border bg-card p-3 hover:bg-accent">
                  <span className="truncate font-medium" title={e.title}>{e.title}</span>
                  <span className="flex justify-between gap-2 text-xs text-muted-foreground">
                    <span>{t("Problems: {n}", { n: e.problems.length })}</span>
                    <span>{when(e.created_at)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="group-problems" className="space-y-3 pt-2">
        <h2 id="group-problems" className="text-sm font-semibold">{t("Problems")}</h2>
        {g.problems.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">{t("No problems yet: they appear here once an exam of this group has them, or an answer from this group is added to one.")}</Card>
        ) : (
          <ProblemBrowser rows={g.problems} allTags={tags.data ?? []}
            meta={(p) => <span>{t("{n} answers · {approved} approved", { n: p.answers, approved: p.approved })}</span>}
            actions={(p) => p.status === "ready" && !p.archived && (<>
              <AddAnswers problemId={p.id} groups={[g]} group={g} onGroup={() => {}} lockGroup onAdded={group.reload}
                          trigger={t("Add answer(s) to {title}", { title: p.title })} />
              <Button size="sm" variant="outline" disabled={!p.to_grade.length || grade.busy}
                      title={t("Grade this group's answers that are not graded yet")}
                      onClick={() => grade.run(async () => { await api.post("/api/answers/grade", { answer_ids: p.to_grade }); await group.reload(); })}>
                <Sparkles /> {t("Grade ({n})", { n: p.to_grade.length })}
              </Button>
            </>)} />
        )}
      </section>
    </Page>
  );
}
