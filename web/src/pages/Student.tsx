import { useEffect, useState } from "react";
import Capture from "@/components/Capture";
import { clock, ErrorText, useAction, useLoad, when } from "@/components/common";
import { LanguageSelect, useLocalLang } from "@/components/Prefs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, pagesForm, type Page } from "@/lib/api";
import { t } from "@/lib/i18n";

type Receipt = { problem_id: string; version: number; pages: number; files: string[]; received_at: string };
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
  const [sent, setSent] = useState<Receipt[]>([]);
  useEffect(() => { if (i) setSent(i.received); }, [i]);
  const done = i ? i.problems.filter((p) => sent.some((r) => r.problem_id === p.id)) : [];
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
                  <Thumbs token={token} files={r.files} />
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
          {sent.length > 0 && (  // PL-65: one line says what is still missing, so a tick on one card is not read as "done"
            <p role="status" className={`rounded-md border px-3 py-2 text-sm ${done.length < i.problems.length ? "border-warning bg-warning/15" : "border-success/60 text-success"}`}>
              {t("Sent: {n} of {total} exercises.", { n: done.length, total: i.problems.length })}
              {done.length < i.problems.length && <> {t("Not sent yet: {titles}", { titles: i.problems.filter((p) => !done.includes(p)).map((p) => p.title).join(", ") })}</>}
            </p>
          )}
          {i.problems.map((p) => <ProblemUpload key={p.id} token={token} problem={p} name={name}
                                                sent={sent.filter((r) => r.problem_id === p.id)} onSent={(r) => setSent([...sent, r])} />)}
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

/** PL-65: small pictures of the pages received; a tap opens the page in a preview with a Close button (I4). */
function Thumbs({ token, files }: { token: string; files: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const url = (f: string) => `/api/public/links/${token}/files/${f}`;
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      {files.map((f, n) => (
        <button key={f} type="button" onClick={() => setOpen(n)} aria-label={t("Open page {n} at full size", { n: n + 1 })}>
          <img src={url(f)} alt="" className="h-16 w-12 rounded border bg-white object-cover" />
        </button>
      ))}
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="flex max-h-[95dvh] max-w-[95vw] flex-col gap-3 p-3 sm:max-w-3xl">
          <DialogTitle className="text-sm">{t("Page {n}", { n: (open ?? 0) + 1 })}</DialogTitle>
          {open !== null && <img src={url(files[open])} alt="" className="min-h-0 flex-1 rounded bg-white object-contain" />}
          <DialogClose asChild><Button variant="outline" className="w-full">{t("Close")}</Button></DialogClose>
        </DialogContent>
      </Dialog>
    </span>
  );
}

function ProblemUpload({ token, problem, name, sent, onSent }: {
  token: string; problem: { id: string; title: string }; name: string; sent: Receipt[]; onSent: (r: Receipt) => void;
}) {
  const [pages, setPages] = useState<Page[]>([]);
  const act = useAction();
  const send = () => act.run(async () => {
    onSent(await api.form<Receipt>(`/api/public/links/${token}/answers`, pagesForm(pages, { student_name: name, problem_id: problem.id })));
    setPages([]);
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{problem.title}</CardTitle>
        {sent.map((r) => (
          <div key={r.version} className="text-sm text-success">✓ <ReceiptText r={r} /><Thumbs token={token} files={r.files} /></div>
        ))}
        {!sent.length && <p className="text-sm text-muted-foreground">{t("Not sent yet")}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <Capture pages={pages} onChange={setPages} label="answer pages" disabled={act.busy} />
        {pages.length > 0 && <p className="text-sm">{t("Check the pages above: these {n} will be sent for “{title}”.", { n: pages.length, title: problem.title })}</p>}
        <ErrorText>{act.error}</ErrorText>
        <Button className="w-full" disabled={!pages.length || !name.trim() || act.busy} onClick={send}>
          {!name.trim() ? t("Type your name first") : !pages.length ? t("Add your pages first") : sent.length ? t("Send a new version") : t("Send")}
        </Button>
      </CardContent>
    </Card>
  );
}
