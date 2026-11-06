import { useEffect, useState } from "react";
import { ErrorText, Page, useAction, useLoad, usd } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";
import { navigate } from "@/lib/router";

type Prefs = { link_minutes: number; export_format: "xlsx" | "csv"; has_api_key: boolean; api_key_last4: string | null };
type Row = { id: string; usd: number; tokens: number; calls: number };
type Costs = {
  total_usd: number;
  problems: { id: string; title: string; setup_usd: number; grading_usd: number; tokens: number }[];
  groups: (Row & { name: string })[];
  exams: (Row & { title: string })[];
  exam_groups: (Row & { exam_title: string; group_name: string })[];
};

/** PL-06, PL-08 and the spending views of PL-33; theme and language are in the top bar (PL-07, PL-37). */
export default function Settings({ onSignOut }: { onSignOut: () => void }) {
  const prefs = useLoad(() => api.get<Prefs>("/api/settings"), []);
  const costs = useLoad(() => api.get<Costs>("/api/costs"), []);
  const [key, setKey] = useState("");
  const [minutes, setMinutes] = useState("");
  const keyAct = useAction();
  const prefAct = useAction();
  const p = prefs.data;
  useEffect(() => { if (p) setMinutes(String(p.link_minutes)); }, [p]);

  const saveMinutes = () =>
    prefAct.run(async () => prefs.setData(await api.put<Prefs>("/api/settings", { link_minutes: Number(minutes) })));

  return (
    <Page title={t("Settings")}>
      <ErrorText>{prefs.error}</ErrorText>
      {p && (
        <div className="cols">
          <Card>
            <CardHeader>
              <CardTitle>{t("OpenAI API key")}</CardTitle>
              <CardDescription>{t("Your AI calls are billed to this key. It is stored encrypted and never shown again.")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                {p.has_api_key ? <>{t("Saved key ending in")} <code className="font-mono">…{p.api_key_last4}</code></> : t("No key saved: AI actions are off.")}
              </p>
              <form className="flex gap-2" onSubmit={(e) => {
                e.preventDefault();
                keyAct.run(async () => { prefs.setData(await api.put<Prefs>("/api/settings/api-key", { api_key: key })); setKey(""); });
              }}>
                <Input type="password" autoComplete="off" placeholder="sk-…" value={key}
                       onChange={(e) => setKey(e.target.value)} aria-label={t("New API key")} />
                <Button type="submit" disabled={keyAct.busy || key.length < 20}>{t("Save")}</Button>
              </form>
              {p.has_api_key && (
                <Button variant="outline" size="sm" disabled={keyAct.busy}
                        onClick={() => keyAct.run(async () => prefs.setData(await api.del<Prefs>("/api/settings/api-key")))}>
                  {t("Remove key")}
                </Button>
              )}
              <ErrorText>{keyAct.error}</ErrorText>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Preferences")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-1.5" onSubmit={(e) => { e.preventDefault(); saveMinutes(); }}>
                <Label htmlFor="mins">{t("Student upload links close after (minutes)")}</Label>
                <div className="flex gap-2">
                  <Input id="mins" type="number" min={1} max={240} className="w-28" value={minutes}
                         onChange={(e) => setMinutes(e.target.value)} />
                  <Button type="submit" variant="outline" disabled={prefAct.busy || Number(minutes) === p.link_minutes}>{t("Save")}</Button>
                </div>
              </form>
              {/* PL-61: the exam page's export starts with this format */}
              <div className="space-y-1.5">
                <Label id="export-format">{t("Export marks as")}</Label>
                <Select value={p.export_format} disabled={prefAct.busy}
                        onValueChange={(v) => prefAct.run(async () => prefs.setData(await api.put<Prefs>("/api/settings", { export_format: v })))}>
                  <SelectTrigger className="w-40" aria-labelledby="export-format"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ErrorText>{prefAct.error}</ErrorText>
              <Button variant="outline" className="sm:hidden"
                      onClick={async () => { await api.post("/api/auth/logout"); onSignOut(); navigate("/"); }}>
                {t("Sign out")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("Spending")}</CardTitle>
          <CardDescription>
            {t("Estimated from token counts and published prices (prices.json). Total:")} <strong>{usd(costs.data?.total_usd)}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ErrorText>{costs.error}</ErrorText>
          {costs.data && (
            <>
              <CostTable title={t("Per problem")} head={[t("Problem"), t("Preparing"), t("Grading")]}
                         rows={costs.data.problems.map((r) => [r.title, usd(r.setup_usd), usd(r.grading_usd)])} />
              <CostTable title={t("Per exam (grading)")} head={[t("Exam"), t("Answers graded"), t("Cost")]}
                         rows={costs.data.exams.map((r) => [r.title, String(r.calls), usd(r.usd)])} />
              <CostTable title={t("Per group (grading)")} head={[t("Group"), t("Answers graded"), t("Cost")]}
                         rows={costs.data.groups.map((r) => [r.name, String(r.calls), usd(r.usd)])} />
              <CostTable title={t("Per exam and group (grading)")} head={[t("Exam · Group"), t("Answers graded"), t("Cost")]}
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
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("Nothing spent yet.")}</p> : (
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
