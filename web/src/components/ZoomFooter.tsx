import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { getZoom, setZoom, ZOOMS } from "@/lib/zoom";

/** PL-39: fixed at the bottom and counter-zoomed, so it keeps its size while the page zooms. */
export default function ZoomFooter() {
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
    <footer style={{ zoom: 1 / z }}
            className="fixed inset-x-0 bottom-0 z-40 flex h-7 items-center justify-end gap-1 border-t bg-background/95 px-3 text-xs text-muted-foreground backdrop-blur">
      <span className="mr-1">{t("Zoom")}</span>
      <Button variant="ghost" size="icon" className="size-6" aria-label={t("Zoom out")} disabled={i <= 0}
              onClick={() => step(-1)}><Minus className="size-3.5" /></Button>
      <Button variant="ghost" size="sm" className="h-6 min-w-12 px-1 text-xs tabular-nums"
              aria-label={t("Reset zoom ({pct})", { pct })} title={t("Reset zoom ({pct})", { pct })}
              onClick={() => go(1)}>{pct}</Button>
      <Button variant="ghost" size="icon" className="size-6" aria-label={t("Zoom in")} disabled={i >= ZOOMS.length - 1}
              onClick={() => step(1)}><Plus className="size-3.5" /></Button>
    </footer>
  );
}
