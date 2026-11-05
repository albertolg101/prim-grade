import { useState } from "react";
import { ErrorText, Page, useAction, useLoad } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type Group } from "@/lib/api";
import { t } from "@/lib/i18n";

/** PL-25: groups and the students who have submitted in each. */
export default function Groups() {
  const groups = useLoad(() => api.get<Group[]>("/api/groups"), []);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const act = useAction();
  const save = (fn: () => Promise<unknown>) => act.run(async () => { await fn(); await groups.reload(); });
  const list = groups.data?.filter((g) => showArchived || !g.archived) ?? [];

  return (
    <Page title={t("Groups")}>
      <form className="flex max-w-md gap-2" onSubmit={(e) => {
        e.preventDefault();
        save(() => api.post("/api/groups", { name })).then(() => setName(""));
      }}>
        <Input placeholder={t("New group, e.g. Mechanics A")} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("Group name")} />
        <Button type="submit" disabled={!name.trim() || act.busy}>{t("Add")}</Button>
      </form>
      <ErrorText>{groups.error ?? act.error}</ErrorText>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> {t("Show archived")}
      </label>
      {list.length === 0 && groups.data && <p className="text-sm text-muted-foreground">{t("No groups yet.")}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((g) => (
          <Card key={g.id} className={g.archived ? "opacity-60" : ""}>
            <CardHeader>
              {editing?.id === g.id ? (
                <form className="flex gap-2" onSubmit={(e) => {
                  e.preventDefault();
                  save(() => api.patch(`/api/groups/${g.id}`, { name: editing.name })).then(() => setEditing(null));
                }}>
                  <Input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label={t("Group name")} />
                  <Button type="submit" size="sm">{t("Save")}</Button>
                </form>
              ) : <CardTitle>{g.name}</CardTitle>}
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {g.students.length ? t("Students who have submitted ({n}): {names}", { n: g.students.length, names: g.students.join(", ") }) : t("No submissions yet.")}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing({ id: g.id, name: g.name })}>{t("Rename")}</Button>
                <Button size="sm" variant="outline" onClick={() => save(() => api.patch(`/api/groups/${g.id}`, { archived: !g.archived }))}>
                  {g.archived ? t("Unarchive") : t("Archive")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Page>
  );
}
