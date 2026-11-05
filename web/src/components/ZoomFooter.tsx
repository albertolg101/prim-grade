import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getZoom, setZoom, ZOOMS } from "@/lib/zoom";

/** PL-39: fixed at the bottom; sized in px, not rem, so it keeps its size while the page zooms.
 * Beside the sidebar on a computer (left-60 is in rem, like the sidebar's width). */
export default function ZoomFooter({ besideSidebar = false }: { besideSidebar?: boolean }) {
  const [z, setZ] = useState(getZoom());
  const i = ZOOMS.indexOf(z);
  // step from the live value, so quick repeated clicks never skip or repeat a level
  const step = (d: number) => {
    const j = Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(getZoom()) + d));
    go(ZOOMS[j]);
  };
  const go = (next: number) => { setZoom(next); setZ(next); };
  const pct = `${Math.round(z * 100)}%`;
  return (
    <footer className={cn("fixed inset-x-0 bottom-0 z-40 flex h-[28px] items-center justify-end gap-[4px] border-t bg-background/95 px-[12px] text-[12px] text-muted-foreground backdrop-blur",
              besideSidebar && "md:left-60")}>
      <span className="mr-[4px]">{t("Zoom")}</span>
      <Button variant="ghost" size="icon" className="size-[24px] rounded-[6px]" aria-label={t("Zoom out")} disabled={i <= 0}
              onClick={() => step(-1)}><Minus className="size-[14px]" /></Button>
      <Button variant="ghost" size="sm" className="h-[24px] min-w-[48px] rounded-[6px] px-[4px] text-[12px] tabular-nums"
              aria-label={t("Reset zoom ({pct})", { pct })} title={t("Reset zoom ({pct})", { pct })}
              onClick={() => go(1)}>{pct}</Button>
      <Button variant="ghost" size="icon" className="size-[24px] rounded-[6px]" aria-label={t("Zoom in")} disabled={i >= ZOOMS.length - 1}
              onClick={() => step(1)}><Plus className="size-[14px]" /></Button>
    </footer>
  );
}
