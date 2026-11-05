import { useState } from "react";
import { ErrorText, Page, useAction, useLoad } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type Exam } from "@/lib/api";
import { t } from "@/lib/i18n";
import { navigate } from "@/lib/router";

/** PL-26: exams group problems and are given to one or more groups. */
export default function Exams() {
  const list = useLoad(() => api.get<Exam[]>("/api/exams"), []);
  const [title, setTitle] = useState("");
  const act = useAction();
  return (
    <Page title={t("Exams")}>
      <form className="flex max-w-lg gap-2" onSubmit={(e) => {
        e.preventDefault();
        act.run(async () => navigate(`/exams/${(await api.post<Exam>("/api/exams", { title })).id}`));
      }}>
        <Input placeholder={t("New exam title")} value={title} onChange={(e) => setTitle(e.target.value)} aria-label={t("Exam title")} />
        <Button type="submit" disabled={!title.trim() || act.busy}>{t("Create")}</Button>
      </form>
      <ErrorText>{list.error ?? act.error}</ErrorText>
      {list.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("No exams yet.")}</p>}
      <Card className="divide-y gap-0 overflow-hidden py-0">
        {list.data?.map((e) => (
          <a key={e.id} href={`/exams/${e.id}`} onClick={(ev) => { ev.preventDefault(); navigate(`/exams/${e.id}`); }}
             className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent">
            <span className="min-w-0 truncate font-medium">{e.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("Problems: {n}", { n: e.problems.length })} · {e.groups.map((g) => g.name).join(", ") || t("no group")}
            </span>
          </a>
        ))}
      </Card>
    </Page>
  );
}
