import { useEffect, useState } from "react";
import Capture from "@/components/Capture";
import { clock, ErrorText, useAction, useLoad, when } from "@/components/common";
import { LanguageSelect, useLocalLang } from "@/components/Prefs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, pagesForm, type Page } from "@/lib/api";
import { t } from "@/lib/i18n";

type Receipt = { problem_id: string; version: number; pages: number; received_at: string };
type LinkInfo = {
  exam_title: string; group_name: string; open: boolean; expires_at: string; cookie_note: string; problems: { id: string; title: string }[];
  student_name: string | null; received: Receipt[];  // PL-57: what this browser already sent, kept across tabs and links
};

/** PL-29 to PL-31, PL-35: no account; the student types their name and uploads per problem. */
export default function Student({ token }: { token: string }) {
  const info = useLoad(() => api.get<LinkInfo>(`/api/public/links/${token}`), [token]);
  const [name, setName] = useState("");
  const [lang, setLang] = useLocalLang();
  const i = info.data;
  const bound = i?.student_name ?? null;  // PL-35: once this browser has sent, it sends for that name only
  useEffect(() => { if (bound) setName(bound); }, [bound]);
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 pt-6 pb-[calc(1.5rem+var(--footer-pad))]">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-primary">PrimGrade</h1>
        <LanguageSelect value={lang} onChange={setLang} />
      </div>
      <ErrorText>{info.error}</ErrorText>
      {i && !i.open && (
        <Card><CardHeader><CardTitle>{t("This upload link is closed")}</CardTitle>
          <CardDescription>{t("It accepts no more answers. If you still need to submit, ask your teacher.")}</CardDescription></CardHeader>
          {i.received.length > 0 && (
            <CardContent className="space-y-1">
              <p className="text-sm font-medium">{t("What you sent, as {name}", { name: bound ?? "" })}</p>
              {i.received.map((r) => (
                <p key={`${r.problem_id}-${r.version}`} className="text-sm text-success">
                  ✓ {i.problems.find((p) => p.id === r.problem_id)?.title ?? t("Problem")}: <ReceiptText r={r} />
                </p>
              ))}
            </CardContent>
          )}
        </Card>
      )}
      {i?.open && (
        <>
          <div>
            <h2 className="text-lg font-semibold">{i.exam_title}</h2>
            <p className="text-sm text-muted-foreground">{i.group_name} · {t("open until {time}", { time: clock(new Date(i.expires_at)) })}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("Your full name")}</Label>
            <Input id="name" autoComplete="name" value={name} readOnly={!!bound} onChange={(e) => setName(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              {bound ? t("This browser has already sent answers as {name}, so it keeps that name.", { name: bound })
                : t("Upload only your own answer. Your teacher sees the name, the time and every version you send.")}
            </p>
          </div>
          {i.problems.map((p) => <ProblemUpload key={p.id} token={token} problem={p} name={name} received={i.received.filter((r) => r.problem_id === p.id)} />)}
          <p className="text-xs text-muted-foreground">{t("This page sets one cookie so that this browser submits for one student only in this exam. It holds no name and no answers.")}</p>
        </>
      )}
    </div>
  );
}

function ReceiptText({ r }: { r: Receipt }) {
  return <>{r.version > 1
    ? t("Received at {time}: pages {n} (version {v})", { time: when(r.received_at), n: r.pages, v: r.version })
    : t("Received at {time}: pages {n}", { time: when(r.received_at), n: r.pages })}</>;
}

function ProblemUpload({ token, problem, name, received }: { token: string; problem: { id: string; title: string }; name: string; received: Receipt[] }) {
  const [pages, setPages] = useState<Page[]>([]);
  const [sent, setSent] = useState<Receipt[]>(received);
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
          <p key={r.version} className="text-sm text-success">✓ <ReceiptText r={r} /></p>
        ))}
      </CardHeader>
      <CardContent className="space-y-3">
        <Capture pages={pages} onChange={setPages} label="answer pages" disabled={act.busy} />
        {pages.length > 0 && <p className="text-sm">{t("Check the pages above: these {n} will be sent for “{title}”.", { n: pages.length, title: problem.title })}</p>}
        <ErrorText>{act.error}</ErrorText>
        <Button className="w-full" disabled={!pages.length || !name.trim() || act.busy} onClick={send}>
          {!name.trim() ? t("Type your name first") : sent.length ? t("Send a new version") : t("Send")}
        </Button>
      </CardContent>
    </Card>
  );
}
