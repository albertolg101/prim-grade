import es from "@/locales/es.json";
import ru from "@/locales/ru.json";

/** PL-37: English, Spanish or Russian. English text is the key; es.json and ru.json translate it
 * (server/tests/test_web_i18n.py checks every t("…") literal has both). */
export type Lang = "en" | "es" | "ru";
export const LANGS: [Lang, string][] = [["en", "English"], ["es", "Español"], ["ru", "Русский"]];

const DICTS: Record<Lang, Record<string, string>> = { en: {}, es, ru };
const KEY = "primgrade.lang";

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "es" || saved === "ru") return saved;
  } catch { /* storage blocked: fall back to the browser language */ }
  const nav = navigator.language.slice(0, 2);
  return nav === "es" || nav === "ru" ? nav : "en";
}

let lang: Lang = initial();
document.documentElement.lang = lang;

export const getLang = () => lang;

/** Set before re-rendering: the caller keeps the language in React state so the tree re-renders. */
export function setLang(next: Lang) {
  lang = next;
  document.documentElement.lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* per-browser convenience only */ }
}

/** t("Received {n} pages", { n: 2 }). Unknown text (e.g. a server message) stays as it is. */
export function t(text: string, vars?: Record<string, string | number>): string {
  let out = DICTS[lang][text] ?? text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}
