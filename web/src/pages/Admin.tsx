import { ErrorText, Page, useAction, useLoad, usd } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type Me } from "@/lib/api";
import { t } from "@/lib/i18n";

type User = { id: string; email: string; name: string; status: string; is_admin: boolean; created_at: string };
type Usage = { user_id: string; name: string; email: string; tokens: number; usd: number; calls: number;
  months: { month: string; tokens: number; usd: number; calls: number }[] };

/** PL-03 and PL-05: approve teachers, grant admin rights, see what each teacher spent. */
export default function Admin({ me }: { me: Me }) {
  const users = useLoad(() => api.get<User[]>("/api/admin/users"), []);
  const usage = useLoad(() => api.get<Usage[]>("/api/admin/usage"), []);
  const act = useAction();
  const change = (url: string, body: unknown) => act.run(async () => { await api.post(url, body); await users.reload(); });
  const pending = users.data?.filter((u) => u.status === "pending") ?? [];

  return (
    <Page title={t("Admin")}>
      <ErrorText>{users.error ?? act.error}</ErrorText>
      {pending.length > 0 && (
        <Card className="border-primary">
          <CardHeader><CardTitle>{t("Waiting for approval ({n})", { n: pending.length })}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pending.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0"><div className="font-medium">{u.name}</div><div className="truncate text-sm text-muted-foreground">{u.email}</div></div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={act.busy} onClick={() => change(`/api/admin/users/${u.id}/status`, { status: "approved" })}>{t("Approve")}</Button>
                  <Button size="sm" variant="outline" disabled={act.busy} onClick={() => change(`/api/admin/users/${u.id}/status`, { status: "rejected" })}>{t("Reject")}</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>{t("Teachers")}</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {users.data?.filter((u) => u.status !== "pending").map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <div className="font-medium">{u.name} {u.is_admin && <Badge className="ml-1">{t("admin")}</Badge>}
                  {u.status !== "approved" && <Badge variant="outline" className="ml-1">{t(u.status)}</Badge>}</div>
                <div className="truncate text-sm text-muted-foreground">{u.email}</div>
              </div>
              {u.id !== me.id && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={act.busy}
                          onClick={() => change(`/api/admin/users/${u.id}/admin`, { is_admin: !u.is_admin })}>
                    {u.is_admin ? t("Remove admin") : t("Make admin")}
                  </Button>
                  <Button size="sm" variant="outline" disabled={act.busy}
                          onClick={() => change(`/api/admin/users/${u.id}/status`, { status: u.status === "approved" ? "deactivated" : "approved" })}>
                    {u.status === "approved" ? t("Deactivate") : t("Reactivate")}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("Spending per teacher")}</CardTitle></CardHeader>
        <CardContent>
          <ErrorText>{usage.error}</ErrorText>
          {usage.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("No AI calls yet.")}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {usage.data?.map((u) => [
                  <tr key={u.user_id} className="border-t font-medium">
                    <td className="py-1.5">{u.name}</td><td className="text-right tabular-nums">{t("{n} tokens", { n: u.tokens.toLocaleString() })}</td><td className="text-right tabular-nums">{usd(u.usd)}</td>
                  </tr>,
                  ...u.months.map((m) => (
                    <tr key={u.user_id + m.month} className="text-muted-foreground">
                      <td className="pl-4">{m.month}</td><td className="text-right tabular-nums">{m.tokens.toLocaleString()}</td><td className="text-right tabular-nums">{usd(m.usd)}</td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}
