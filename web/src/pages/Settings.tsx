import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { ErrorText, Page, useAction, useLoad, usd } from "@/components/common";
import { ALL_TIME, DateFilter, bounds } from "@/components/DateRange";
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
  groups: (Row & { name: string })[];
  exams: (Row & { title: string })[];
  exam_groups: (Row & { exam_title: string; group_name: string })[];
};

/** PL-06, PL-08 and the spending views of PL-33; theme and language are in the top bar (PL-07, PL-37). */
export default function Settings({ onSignOut }: { onSignOut: () => void }) {
  const prefs = useLoad(() => api.get<Prefs>("/api/settings"), []);
  // PL-62: spending for a period, narrowed by exam or group name
  const [period, setPeriod] = useState(ALL_TIME);
  const [q, setQ] = useState("");
  const [since, until] = bounds(period);
  const range = new URLSearchParams({ ...(since && { since: since.toISOString() }), ...(until && { until: until.toISOString() }) }).toString();
  const costs = useLoad(() => api.get<Costs>(`/api/costs${range ? `?${range}` : ""}`), [range]);
  const words = q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const hit = (...names: string[]) => words.every((w) => names.some((n) => n.toLocaleLowerCase().includes(w)));
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
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" className="h-8 pl-8" aria-label={t("Search spending")} placeholder={t("Search by exam or group")}
                     value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="w-48"><DateFilter title={t("Period")} value={period} onChange={setPeriod} /></div>
          </div>
          <ErrorText>{costs.error}</ErrorText>
          {costs.data && (
            <>
              <CostTable title={t("Per exam and group")} head={[t("Exam"), t("Group")]}
                         rows={costs.data.exam_groups.filter((r) => hit(r.exam_title, r.group_name)).map((r) => [[r.exam_title, r.group_name], r.calls, r.usd])} />
              <CostTable title={t("Per exam")} head={[t("Exam")]}
                         rows={costs.data.exams.filter((r) => hit(r.title)).map((r) => [[r.title], r.calls, r.usd])} />
              <CostTable title={t("Per group")} head={[t("Group")]}
                         rows={costs.data.groups.filter((r) => hit(r.name)).map((r) => [[r.name], r.calls, r.usd])} />
            </>
          )}
        </CardContent>
      </Card>
    </Page>
  );
}

/** PL-62: every spending table has the same columns at the same widths, so the numbers line up. */
function CostTable({ title, head, rows }: { title: string; head: string[]; rows: [string[], number, number][] }) {
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-medium">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("Nothing spent in this period.")}</p> : (
        <table className="w-full table-fixed text-sm">
          <colgroup>{head.map((h) => <col key={h} />)}<col className="w-28 sm:w-36" /><col className="w-24" /></colgroup>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              {head.map((h) => <th key={h} className="pb-1 font-normal">{h}</th>)}
              <th className="pb-1 text-right font-normal">{t("Answers graded")}</th>
              <th className="pb-1 text-right font-normal">{t("Cost")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([names, calls, cost], i) => (
              <tr key={i} className="border-t">
                {names.map((n, j) => <td key={j} className="truncate py-1.5 pr-3" title={n}>{n}</td>)}
                <td className="py-1.5 text-right tabular-nums">{calls}</td>
                <td className="py-1.5 text-right tabular-nums">{usd(cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
