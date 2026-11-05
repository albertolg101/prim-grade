import { useState } from "react";
import { ErrorText, useAction } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Me } from "@/lib/api";

/** PL-01, PL-04: sign in, or sign up and wait for an admin's approval. */
export default function Auth({ onIn }: { onIn: (m: Me) => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    run(async () => {
      if (mode === "up") {
        const u = await api.post<{ status: string }>("/api/auth/signup", form);
        if (u.status !== "approved") {
          setNotice("Account created. An admin must approve it before you can sign in.");
          setMode("in");
          return;
        }
      }
      await api.post("/api/auth/login", { email: form.email, password: form.password });
      onIn(await api.get<Me>("/api/auth/me"));
    });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl"><span className="text-primary">PrimGrade</span></CardTitle>
          <CardDescription>
            {mode === "in" ? "Sign in to review your students' answers." : "Create a teacher account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
            </div>
            {mode === "up" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" autoComplete="name" required value={form.name} onChange={set("name")} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={mode === "up" ? 8 : 1}
                     autoComplete={mode === "in" ? "current-password" : "new-password"}
                     value={form.password} onChange={set("password")} />
              {mode === "up" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
            </div>
            {notice && <p className="rounded-md bg-accent p-2 text-sm">{notice}</p>}
            <ErrorText>{error}</ErrorText>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "in" ? "Sign in" : "Sign up"}
            </Button>
          </form>
          <button type="button" className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
