import { useState } from "react";
import Capture from "@/components/Capture";
import { ErrorText, useAction, useLoad, when } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, pagesForm, type Page } from "@/lib/api";

type LinkInfo = { exam_title: string; group_name: string; open: boolean; expires_at: string; cookie_note: string; problems: { id: string; title: string }[] };
type Receipt = { version: number; pages: number; received_at: string };

/** PL-29 to PL-31, PL-35: no account; the student types their name and uploads per problem. */
export default function Student({ token }: { token: string }) {
  const info = useLoad(() => api.get<LinkInfo>(`/api/public/links/${token}`), [token]);
  const [name, setName] = useState("");
  const i = info.data;
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <h1 className="text-xl font-semibold text-primary">PrimGrade</h1>
      <ErrorText>{info.error}</ErrorText>
      {i && !i.open && (
        <Card><CardHeader><CardTitle>This upload link is closed</CardTitle>
          <CardDescription>It accepts no more answers. If you still need to submit, ask your teacher.</CardDescription></CardHeader></Card>
      )}
      {i?.open && (
        <>
          <div>
            <h2 className="text-lg font-semibold">{i.exam_title}</h2>
            <p className="text-sm text-muted-foreground">{i.group_name} · open until {new Date(i.expires_at).toLocaleTimeString()}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Your full name</Label>
            <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            <p className="text-xs text-muted-foreground">Upload only your own answer. Your teacher sees the name, the time and every version you send.</p>
          </div>
          {i.problems.map((p) => <ProblemUpload key={p.id} token={token} problem={p} name={name} />)}
          <p className="text-xs text-muted-foreground">{i.cookie_note}</p>
        </>
      )}
    </div>
  );
}

function ProblemUpload({ token, problem, name }: { token: string; problem: { id: string; title: string }; name: string }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [sent, setSent] = useState<Receipt[]>([]);
  const act = useAction();
  const send = () => act.run(async () => {
    const r = await api.form<Receipt>(`/api/public/links/${token}/answers`, pagesForm(pages, { student_name: name, problem_id: problem.id }));
    setSent([...sent, r]);
    setPages([]);
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{problem.title}</CardTitle>
        {sent.map((r) => (
          <p key={r.version} className="text-sm text-success">✓ Received {r.pages} page{r.pages === 1 ? "" : "s"} at {when(r.received_at)}{r.version > 1 ? ` (version ${r.version})` : ""}</p>
        ))}
      </CardHeader>
      <CardContent className="space-y-3">
        <Capture pages={pages} onChange={setPages} label="answer pages" disabled={act.busy} />
        {pages.length > 0 && <p className="text-sm">Check the pages above: these {pages.length} will be sent for “{problem.title}”.</p>}
        <ErrorText>{act.error}</ErrorText>
        <Button className="w-full" disabled={!pages.length || !name.trim() || act.busy} onClick={send}>
          {!name.trim() ? "Type your name first" : sent.length ? "Send a new version" : "Send"}
        </Button>
      </CardContent>
    </Card>
  );
}
