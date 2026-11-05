import { useEffect, useState } from "react";
import { ErrorText, Page, useAction, useLoad, usd } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Theme } from "@/lib/api";
import { navigate } from "@/lib/router";

type Prefs = { theme: Theme; link_minutes: number; has_api_key: boolean; api_key_last4: string | null };
type Row = { id: string; usd: number; tokens: number; calls: number };
type Costs = {
  total_usd: number;
  problems: { id: string; title: string; setup_usd: number; grading_usd: number; tokens: number }[];
  groups: (Row & { name: string })[];
  exams: (Row & { title: string })[];
  exam_groups: (Row & { exam_title: string; group_name: string })[];
};

/** PL-06–08 and the spending views of PL-33. */
export default function Settings({ onTheme, onSignOut }: { onTheme: (t: Theme) => void; onSignOut: () => void }) {
  const prefs = useLoad(() => api.get<Prefs>("/api/settings"), []);
  const costs = useLoad(() => api.get<Costs>("/api/costs"), []);
  const [key, setKey] = useState("");
  const [minutes, setMinutes] = useState("");
  const keyAct = useAction();
  const prefAct = useAction();
  const p = prefs.data;
  useEffect(() => { if (p) setMinutes(String(p.link_minutes)); }, [p]);

  const savePrefs = (next: Partial<Prefs>) =>
    prefAct.run(async () => {
      const out = await api.put<Prefs>("/api/settings", { theme: p!.theme, link_minutes: p!.link_minutes, ...next });
      prefs.setData(out);
      onTheme(out.theme);
    });

  return (
    <Page title="Settings">
      <ErrorText>{prefs.error}</ErrorText>
      {p && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>OpenAI API key</CardTitle>
              <CardDescription>Your AI calls are billed to this key. It is stored encrypted and never shown again.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                {p.has_api_key ? <>Saved key ending in <code className="font-mono">…{p.api_key_last4}</code></> : "No key saved: AI actions are off."}
              </p>
              <form className="flex gap-2" onSubmit={(e) => {
                e.preventDefault();
                keyAct.run(async () => { prefs.setData(await api.put<Prefs>("/api/settings/api-key", { api_key: key })); setKey(""); });
              }}>
                <Input type="password" autoComplete="off" placeholder="sk-…" value={key}
                       onChange={(e) => setKey(e.target.value)} aria-label="New API key" />
                <Button type="submit" disabled={keyAct.busy || key.length < 20}>Save</Button>
              </form>
              {p.has_api_key && (
                <Button variant="outline" size="sm" disabled={keyAct.busy}
                        onClick={() => keyAct.run(async () => prefs.setData(await api.del<Prefs>("/api/settings/api-key")))}>
                  Remove key
                </Button>
              )}
              <ErrorText>{keyAct.error}</ErrorText>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Theme</legend>
                <div className="flex gap-2">
                  {(["system", "light", "dark"] as Theme[]).map((t) => (
                    <Button key={t} size="sm" variant={p.theme === t ? "default" : "outline"}
                            aria-pressed={p.theme === t} onClick={() => savePrefs({ theme: t })}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </Button>
                  ))}
                </div>
              </fieldset>
              <form className="space-y-1.5" onSubmit={(e) => { e.preventDefault(); savePrefs({ link_minutes: Number(minutes) }); }}>
                <Label htmlFor="mins">Student upload links close after (minutes)</Label>
                <div className="flex gap-2">
                  <Input id="mins" type="number" min={1} max={240} className="w-28" value={minutes}
                         onChange={(e) => setMinutes(e.target.value)} />
                  <Button type="submit" variant="outline" disabled={prefAct.busy || Number(minutes) === p.link_minutes}>Save</Button>
                </div>
              </form>
              <ErrorText>{prefAct.error}</ErrorText>
              <Button variant="outline" className="sm:hidden"
                      onClick={async () => { await api.post("/api/auth/logout"); onSignOut(); navigate("/"); }}>
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Spending</CardTitle>
          <CardDescription>
            Estimated from token counts and published prices (prices.json). Total: <strong>{usd(costs.data?.total_usd)}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ErrorText>{costs.error}</ErrorText>
          {costs.data && (
            <>
              <CostTable title="Per problem" head={["Problem", "Preparing", "Grading"]}
                         rows={costs.data.problems.map((r) => [r.title, usd(r.setup_usd), usd(r.grading_usd)])} />
              <CostTable title="Per exam (grading)" head={["Exam", "Answers graded", "Cost"]}
                         rows={costs.data.exams.map((r) => [r.title, String(r.calls), usd(r.usd)])} />
              <CostTable title="Per group (grading)" head={["Group", "Answers graded", "Cost"]}
                         rows={costs.data.groups.map((r) => [r.name, String(r.calls), usd(r.usd)])} />
              <CostTable title="Per exam and group (grading)" head={["Exam · Group", "Answers graded", "Cost"]}
                         rows={costs.data.exam_groups.map((r) => [`${r.exam_title} · ${r.group_name}`, String(r.calls), usd(r.usd)])} />
            </>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}

function CostTable({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-medium">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing spent yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground">{head.map((h, i) => <th key={h} className={i ? "text-right font-normal" : "font-normal"}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className={j ? "py-1 text-right tabular-nums" : "py-1"}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
