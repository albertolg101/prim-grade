import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, type Me } from "@/lib/api";
import { match, navigate, useLocation } from "@/lib/router";
import { applyTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import Admin from "@/pages/Admin";
import Auth from "@/pages/Auth";
import ExamPage from "@/pages/Exam";
import Exams from "@/pages/Exams";
import Groups from "@/pages/Groups";
import ProblemPage from "@/pages/Problem";
import Problems from "@/pages/Problems";
import Review from "@/pages/Review";
import Settings from "@/pages/Settings";
import Student from "@/pages/Student";

const TABS: [string, string][] = [
  ["Problems", "/problems"],
  ["Exams", "/exams"],
  ["Groups", "/groups"],
  ["Settings", "/settings"],
];

export default function App() {
  const loc = useLocation();
  const path = loc.split("?")[0];
  const student = match("/s/:token", path);
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const isStudent = student !== null;

  useEffect(() => {
    if (isStudent) return;
    api.get<Me>("/api/auth/me").then(
      (m) => {
        setMe(m);
        applyTheme(m.theme);
      },
      () => setMe(null),
    );
  }, [isStudent]);

  if (student) return <Student token={student.token} />;
  if (me === undefined) return null;
  if (me === null) return <Auth onIn={(m) => { setMe(m); applyTheme(m.theme); }} />;

  const tabs: [string, string][] = me.is_admin ? [...TABS, ["Admin", "/admin"]] : TABS;
  const fromExam = path.startsWith("/answers") && loc.includes("ctx=exam");
  const active = fromExam ? "/exams" : tabs.find(([, to]) => path.startsWith(to))?.[1] ?? "/problems";
  let page: React.ReactNode;
  let m: Record<string, string> | null;
  if ((m = match("/problems/:id", path))) page = <ProblemPage key={m.id} id={m.id} />;
  else if ((m = match("/answers/:id", path))) page = <Review key={m.id} id={m.id} />;
  else if ((m = match("/exams/:id", path))) page = <ExamPage key={m.id} id={m.id} />;
  else if (path === "/exams") page = <Exams />;
  else if (path === "/groups") page = <Groups />;
  else if (path === "/settings")
    page = <Settings onTheme={(t) => { setMe({ ...me, theme: t }); applyTheme(t); }}
                     onSignOut={() => setMe(null)} />;
  else if (path === "/admin" && me.is_admin) page = <Admin me={me} />;
  else page = <Problems />;

  return (
    <div className="min-h-dvh">
      {me.fake_llm && (
        <div className="bg-warning/25 px-4 py-1.5 text-center text-xs">
          Demo mode: a fake AI model answers every call (PRIMGRADE_LLM=fake). Scores are not real.
        </div>
      )}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-2 sm:px-4">
          <a href="/problems" onClick={(e) => { e.preventDefault(); navigate("/problems"); }}
             className="hidden py-3 pr-3 font-bold text-primary sm:block">PrimGrade</a>
          <nav className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto" aria-label="Main">
            {tabs.map(([label, to]) => (
              <a key={to} href={to}
                 onClick={(e) => { e.preventDefault(); navigate(to); }}
                 aria-current={active === to ? "page" : undefined}
                 className={cn("whitespace-nowrap border-b-2 px-2.5 py-3 text-sm font-medium sm:px-3",
                   active === to ? "border-primary text-foreground"
                     : "border-transparent text-muted-foreground hover:text-foreground")}>
                {label}
              </a>
            ))}
          </nav>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex"
                  onClick={async () => { await api.post("/api/auth/logout"); setMe(null); navigate("/"); }}>
            Sign out
          </Button>
        </div>
      </header>
      <main>{page}</main>
    </div>
  );
}
