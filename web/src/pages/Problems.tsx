import { useState } from "react";
import { ErrorText, Page, useAction, useLoad, when } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type Problem } from "@/lib/api";
import { navigate } from "@/lib/router";

type Row = { id: string; title: string; status: "draft" | "ready"; rubric_version: number; updated_at: string };

/** PL-15: a title is enough to save a draft. */
export default function Problems() {
  const list = useLoad(() => api.get<Row[]>("/api/problems"), []);
  const [title, setTitle] = useState("");
  const act = useAction();

  return (
    <Page title="Problems">
      <form className="flex max-w-lg gap-2" onSubmit={(e) => {
        e.preventDefault();
        act.run(async () => navigate(`/problems/${(await api.post<Problem>("/api/problems", { title })).id}`));
      }}>
        <Input placeholder="New problem title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Problem title" />
        <Button type="submit" disabled={!title.trim() || act.busy}>Save draft</Button>
      </form>
      <ErrorText>{list.error ?? act.error}</ErrorText>
      {list.data?.length === 0 && <p className="text-sm text-muted-foreground">No problems yet. Give one a title to start.</p>}
      <Card className="divide-y gap-0 py-0">
        {list.data?.map((p) => (
          <a key={p.id} href={`/problems/${p.id}`} onClick={(e) => { e.preventDefault(); navigate(`/problems/${p.id}`); }}
             className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent">
            <span className="min-w-0 truncate font-medium">{p.title}</span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">{when(p.updated_at)}</span>
              {p.status === "ready" ? <Badge>Ready · v{p.rubric_version}</Badge> : <Badge variant="outline">Draft</Badge>}
            </span>
          </a>
        ))}
      </Card>
    </Page>
  );
}
