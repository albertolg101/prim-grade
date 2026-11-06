import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import { Button } from "@/components/ui/button";
import { getLang, t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Local calendar day as yyyy-mm-dd (toISOString would shift it to UTC). */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => new Date(`${s}T00:00`);
const label = (s: string) => {
  const d = parse(s);
  return d.toLocaleDateString(getLang(), { day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() && { year: "numeric" }) });
};

/** PL-49: a from–to range picked on one month calendar in the site's own popover; weeks start on Monday.
 * The first click sets the start, the second the end (an earlier day moves the start instead). */
export default function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => { const d = from ? parse(from) : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const today = iso(new Date());
  const first = (month.getDay() + 6) % 7;  // blanks before the 1st, Monday first
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(getLang(), { weekday: "narrow" }));  // 1 Jan 2024 is a Monday
  const pick = (d: string) => {
    if (!from || to || d < from) onChange(d, "");
    else { onChange(from, d); setOpen(false); }
  };
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="outline" size="sm" className={cn("w-full justify-start font-normal", !from && "text-muted-foreground")}>
          <CalendarDays className="text-muted-foreground" />
          <span className="truncate">{from ? `${label(from)} – ${to ? label(to) : "…"}` : t("Pick dates")}</span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} collisionPadding={8}
                         className="z-50 w-64 rounded-md border bg-popover p-3 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="icon" className="size-7" aria-label={t("Previous month")} onClick={() => shift(-1)}><ChevronLeft /></Button>
            <span className="text-sm font-medium capitalize" aria-live="polite">{month.toLocaleDateString(getLang(), { month: "long", year: "numeric" })}</span>
            <Button variant="ghost" size="icon" className="size-7" aria-label={t("Next month")} onClick={() => shift(1)}><ChevronRight /></Button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs">
            {weekdays.map((w, i) => <span key={i} className="pb-1 text-muted-foreground">{w}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={`b${i}`} />;
              const end = d === from || d === to;
              const inside = !!from && !!to && d > from && d < to;
              return (
                <button key={d} type="button" aria-pressed={end} aria-label={parse(d).toLocaleDateString(getLang(), { dateStyle: "full" })}
                        onClick={() => pick(d)}
                        className={cn("h-8 rounded-md text-sm tabular-nums hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          inside && "rounded-none bg-accent",
                          end && "bg-primary font-medium text-primary-foreground hover:bg-primary/90",
                          d === today && !end && "font-semibold text-primary")}>
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>{t("Today")}</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={!from} onClick={() => onChange("", "")}>{t("Clear")}</Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
