import { Fragment, useEffect, useState } from "react";
import { BookOpen, ChevronRight, ClipboardList, Loader2, LogOut, Menu, Settings as SettingsIcon, Shield, Users, X } from "lucide-react";
import { CrumbsContext, type Crumb } from "@/components/common";
import { LanguageSelect, ThemeButtons } from "@/components/Prefs";
import ZoomFooter from "@/components/ZoomFooter";
import { Button } from "@/components/ui/button";
import { api, type Me, type Theme } from "@/lib/api";
import { getLang, setLang, t, type Lang } from "@/lib/i18n";
import { usePreparing } from "@/lib/preparing";
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

type Tab = [string, string, typeof BookOpen];
const TABS: Tab[] = [
  ["Problems", "/problems", BookOpen],
  ["Exams", "/exams", ClipboardList],
  ["Groups", "/groups", Users],
  ["Settings", "/settings", SettingsIcon],
];

export default function App() {
  const loc = useLocation();
  const path = loc.split("?")[0];
  const student = match("/s/:token", path);
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [menu, setMenu] = useState(false);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [prefError, setPrefError] = useState<string | null>(null);
  const [lang, setLangState] = useState<Lang>(getLang());
  const preparing = usePreparing();
  const isStudent = student !== null;

  const signIn = (m: Me) => {
    setMe(m);
    applyTheme(m.theme);
    setLang(m.language);  // the teacher's saved language wins over this browser's (PL-37)
    setLangState(m.language);
  };
  useEffect(() => {
    if (isStudent) return;
    api.get<Me>("/api/auth/me").then(signIn, () => setMe(null));
  }, [isStudent]);
  useEffect(() => setMenu(false), [loc]);

  if (student) return <><Student token={student.token} /><ZoomFooter /></>;
  if (me === undefined) return null;
  if (me === null) return <><Auth onIn={signIn} /><ZoomFooter /></>;

  // the screen changes at once; the server copy follows (theme PL-07, language PL-37)
  const changeTheme = (theme: Theme) => {
    setMe({ ...me, theme });
    applyTheme(theme);
    api.put("/api/settings", { theme }).then(() => setPrefError(null), (e) => setPrefError(e.message));
  };
  const changeLang = (language: Lang) => {
    setLang(language);
    setLangState(language);
    setMe({ ...me, language });
    api.put("/api/settings", { language }).then(() => setPrefError(null), (e) => setPrefError(e.message));
  };

  const tabs: Tab[] = me.is_admin ? [...TABS, ["Admin", "/admin", Shield]] : TABS;
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
    page = <Settings onSignOut={() => setMe(null)} />;
  else if (path === "/admin" && me.is_admin) page = <Admin me={me} />;
  else page = <Problems />;

  const signOut = async () => { await api.post("/api/auth/logout"); setMe(null); navigate("/"); };

  return (
    <CrumbsContext.Provider value={setCrumbs}>
      <div className="min-h-(--screen-h) md:flex">
        {menu && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMenu(false)} />}
        <aside className={cn(
          "fixed top-0 left-0 z-50 flex h-(--screen-h) w-60 flex-col border-r bg-background transition-transform md:sticky md:translate-x-0",
          menu ? "translate-x-0" : "invisible -translate-x-full md:visible")}>
          <div className="flex h-13 items-center justify-between px-4">
            <a href="/problems" onClick={(e) => { e.preventDefault(); navigate("/problems"); }}
               className="text-lg font-bold text-primary">PrimGrade</a>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("Close menu")} onClick={() => setMenu(false)}>
              <X />
            </Button>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label={t("Main")}>
            {tabs.map(([label, to, Icon]) => (
              <a key={to} href={to}
                 onClick={(e) => { e.preventDefault(); navigate(to); }}
                 aria-current={active === to ? "page" : undefined}
                 className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                   active === to ? "bg-primary/15 text-foreground"
                     : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                <Icon className="size-4" />
                {t(label)}
                {to === "/problems" && preparing.size > 0 && (
                  <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" role="status"
                           aria-label={t("AI graders being prepared: {n}", { n: preparing.size })} />
                )}
              </a>
            ))}
          </nav>
          <div className="p-2">
            <p className="truncate px-3 py-1 text-xs text-muted-foreground">{me.email}</p>
            <Button variant="ghost" className="w-full justify-start gap-3 px-3 text-muted-foreground" onClick={signOut}>
              <LogOut className="size-4" /> {t("Sign out")}
            </Button>
          </div>
        </aside>
        <div className="min-w-0 flex-1 pb-(--footer-pad)">
          <header className="sticky top-0 z-30 flex h-13 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur sm:px-4">
            <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("Open menu")} aria-expanded={menu}
                    onClick={() => setMenu(true)}>
              <Menu />
            </Button>
            <nav aria-label={t("Breadcrumb")} className="min-w-0 flex-1">
              <ol className="flex min-w-0 items-center gap-1 text-sm">
                {crumbs.map(([label, to], i) => {
                  const last = i === crumbs.length - 1;
                  return (
                    <Fragment key={i}>
                      <li className={cn("min-w-0", !last && "hidden sm:block")}>
                        {to && !last ? (
                          <a href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}
                             className="block truncate text-muted-foreground hover:text-foreground">{label}</a>
                        ) : (
                          <span aria-current={last ? "page" : undefined} className="block truncate font-medium">{label}</span>
                        )}
                      </li>
                      {!last && <li aria-hidden className="hidden text-muted-foreground sm:block"><ChevronRight className="size-3.5" /></li>}
                    </Fragment>
                  );
                })}
              </ol>
            </nav>
            <ThemeButtons value={me.theme} onChange={changeTheme} />
            <LanguageSelect value={lang} onChange={changeLang} />
          </header>
          {prefError && (
            <p role="alert" className="px-4 py-1.5 text-center text-xs text-destructive">
              {t("Your choice was applied here but not saved: {error}", { error: t(prefError) })}
            </p>
          )}
          {me.fake_llm && (
            <div className="bg-warning/25 px-4 py-1.5 text-center text-xs">
              {t("Demo mode: a fake AI model answers every call (PRIMGRADE_LLM=fake). Scores are not real.")}
            </div>
          )}
          <main>{page}</main>
        </div>
      </div>
      <ZoomFooter besideSidebar />
    </CrumbsContext.Provider>
  );
}
