import { useState } from "react";
import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { Theme } from "@/lib/api";
import { getLang, LANGS, setLang, t, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const THEMES: [Theme, string, typeof Sun][] = [["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]];

/** PL-07: light, dark or system, one press. */
export function ThemeButtons({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  return (
    <div role="radiogroup" aria-label={t("Theme")} className="flex rounded-md border p-0.5">
      {THEMES.map(([id, label, Icon]) => (
        <Button key={id} size="icon" variant="ghost" role="radio" aria-checked={value === id}
                aria-label={t(label)} title={t(label)} onClick={() => onChange(id)}
                className={cn("size-7", value === id ? "bg-primary/15 text-foreground" : "text-muted-foreground")}>
          <Icon className="size-4" />
        </Button>
      ))}
    </div>
  );
}

/** PL-37: the interface language, also the language of the AI's explanations. */
export function LanguageSelect({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Lang)}>
      <SelectTrigger size="sm" aria-label={t("Language")} className="gap-1.5">
        <Languages className="size-4" />
        <span className="uppercase">{value}</span>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {LANGS.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** For pages outside the signed-in layout (sign-in, student link): the choice stays in this browser. */
export function useLocalLang() {
  const [lang, set] = useState(getLang());
  return [lang, (l: Lang) => { setLang(l); set(l); }] as const;
}
