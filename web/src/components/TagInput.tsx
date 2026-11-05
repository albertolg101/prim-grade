import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const lower = (s: string) => s.toLocaleLowerCase();

/** PL-41, PL-42: a text field whose suggestions open in our own menu (a native datalist can't be styled).
 * Arrow keys move, Enter picks, Escape closes; with allowNew, a typed name that is not a tag yet can be created. */
export default function TagInput({ suggestions, onPick, allowNew, label, placeholder, autoFocus, onClose, className }: {
  suggestions: { value: string; hint?: string }[];
  onPick: (tag: string) => void;
  allowNew?: boolean;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  onClose?: () => void;  // Escape, or leaving an empty field
  className?: string;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(!!autoFocus);
  const [active, setActive] = useState(0);
  const q = lower(text.trim());
  const matches = suggestions.filter((s) => lower(s.value).includes(q));
  const exact = suggestions.find((s) => lower(s.value) === q);
  const create = allowNew && q && !exact ? text.trim() : null;
  const items = [...matches.map((s) => ({ ...s, create: false })), ...(create ? [{ value: create, hint: undefined, create: true }] : [])];
  const pick = (value: string) => { onPick(value); setText(""); setActive(0); };

  return (
    <div className={cn("relative", className)}>
      <Input role="combobox" aria-label={label} aria-expanded={open && !!q} aria-controls={`${id}-list`}
             aria-autocomplete="list" aria-activedescendant={open && q && items[active] ? `${id}-${active}` : undefined}
             autoFocus={autoFocus} maxLength={40} placeholder={placeholder} className="h-8 text-sm" value={text}
             onChange={(e) => { setText(e.target.value); setActive(0); setOpen(true); }}
             onFocus={() => setOpen(true)}
             onBlur={() => { setOpen(false); if (!text.trim()) onClose?.(); }}
             onKeyDown={(e) => {
               if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                 e.preventDefault();
                 setOpen(true);
                 if (items.length) setActive((active + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
               } else if (e.key === "Enter") {
                 e.preventDefault();
                 const it = open && q ? items[active] : undefined;
                 if (exact && (!it || it.create)) pick(exact.value);  // a full name in any case is that tag
                 else if (it) pick(it.value);
               } else if (e.key === "Escape") {
                 if (open && text) { setOpen(false); } else onClose?.();
               }
             }} />
      {open && q && (
        // only once something is typed, so the tags are never all listed at once (PL-42);
        // as wide as the field, so it never runs past the panel it sits in
        <ul id={`${id}-list`} role="listbox" aria-label={label}
            className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 scrollbar-thin overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {items.length === 0 && <li className="px-2 py-1.5 text-xs text-muted-foreground">{t("No tag matches “{q}”.", { q: text.trim() })}</li>}
          {items.map((it, i) => (
            <li key={`${it.create}-${it.value}`} id={`${id}-${i}`} role="option" aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}  // keep the focus in the field
                onMouseEnter={() => setActive(i)} onClick={() => pick(it.value)}
                className={cn("flex cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm",
                  i === active && "bg-accent text-accent-foreground")}>
              {it.create ? (
                <span className="flex min-w-0 items-center gap-1.5"><Plus className="size-3.5 shrink-0" />
                  <span className="truncate">{t("Create “{tag}”", { tag: it.value })}</span></span>
              ) : (
                <span className="min-w-0 truncate" title={it.value}>{highlight(it.value, q)}</span>
              )}
              {it.hint && <span className="shrink-0 text-xs text-muted-foreground">{it.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The typed part of a suggestion in bold. */
function highlight(value: string, q: string) {
  const i = q ? lower(value).indexOf(q) : -1;
  if (i < 0) return value;
  return <>{value.slice(0, i)}<strong className="font-semibold">{value.slice(i, i + q.length)}</strong>{value.slice(i + q.length)}</>;
}
