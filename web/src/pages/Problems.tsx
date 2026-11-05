import { useState } from "react";
import { ErrorText, Page, useAction, useLoad, when } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Problem } from "@/lib/api";
import { t } from "@/lib/i18n";
import { navigate } from "@/lib/router";

type Row = { id: string; title: string; status: "draft" | "ready"; rubric_version: number; updated_at: string };

/** PL-15: a title is enough to save a problem; it starts as a draft. */
export default function Problems() {
  const list = useLoad(() => api.get<Row[]>("/api/problems"), []);
  const [title, setTitle] = useState("");
  const act = useAction();

  return (
    <Page title={t("Problems")} actions={
      <Dialog onOpenChange={(open) => { if (!open) { setTitle(""); act.setError(null); } }}>
        <DialogTrigger asChild><Button>{t("New problem")}</Button></DialogTrigger>
        <DialogContent>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            act.run(async () => navigate(`/problems/${(await api.post<Problem>("/api/problems", { title })).id}`));
          }}>
            <DialogHeader><DialogTitle>{t("New problem")}</DialogTitle></DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="problem-name">{t("Name")}</Label>
              <Input id="problem-name" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <ErrorText>{act.error}</ErrorText>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">{t("Cancel")}</Button></DialogClose>
              <Button type="submit" disabled={!title.trim() || act.busy}>{t("Save problem")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    }>
      <ErrorText>{list.error}</ErrorText>
      {list.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("No problems yet. Use New problem to start one.")}</p>}
      {!!list.data?.length && <Card className="divide-y gap-0 py-0">
        {list.data.map((p) => (
          <a key={p.id} href={`/problems/${p.id}`} onClick={(e) => { e.preventDefault(); navigate(`/problems/${p.id}`); }}
             className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent">
            <span className="min-w-0 truncate font-medium">{p.title}</span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">{when(p.updated_at)}</span>
              {p.status === "ready" ? <Badge>{t("Ready · v{n}", { n: p.rubric_version })}</Badge> : <Badge variant="outline">{t("Draft")}</Badge>}
            </span>
          </a>
        ))}
      </Card>}
    </Page>
  );
}
