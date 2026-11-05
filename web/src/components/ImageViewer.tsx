import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileUrl, type FileRef } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const zoom = (v: number) => Math.min(6, v < 1.01 ? 1 : v);  // snap to 100% so float drift never leaves it at 100.0001%

/** PL-22: the paper large, with zoom, pan and page switch; the raw capture of a scan is one click away (PL-14). */
export default function ImageViewer({ pages, start = 0, boxClass, className }: {
  pages: FileRef[]; start?: number; boxClass?: string;  // boxClass: the image area's height (e.g. inside a dialog)
  className?: string;
}) {
  const [i, setI] = useState(start);
  const [raw, setRaw] = useState(false);
  const [z, setZ] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const page = pages[i];
  const id = raw && page?.derived_from ? page.derived_from : page?.id;

  useEffect(() => { setZ(1); setOff({ x: 0, y: 0 }); }, [i, raw]);
  useEffect(() => { if (z === 1) setOff({ x: 0, y: 0 }); }, [z]);  // back at 100% the paper is centred again
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && z === 1) return;  // let the page scroll unless zooming
      e.preventDefault();
      setZ((v) => zoom(v * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [z]);

  if (!page) return <p className="text-sm text-destructive">{t("This answer has no pages.")}</p>;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {pages.length > 1 && pages.map((p, j) => (
          <Button key={p.id} size="sm" variant={j === i ? "default" : "outline"} onClick={() => setI(j)}>{t("Page {n}", { n: j + 1 })}</Button>
        ))}
        <div className="ml-auto flex gap-1">
          <Button size="icon" variant="outline" aria-label={t("Zoom out")} disabled={z <= 1} onClick={() => setZ(zoom(z / 1.4))}><Minus /></Button>
          <Button size="icon" variant="outline" aria-label={t("Zoom in")} disabled={z >= 6} onClick={() => setZ(zoom(z * 1.4))}><Plus /></Button>
          <Button size="sm" variant="outline" title={t("Reset view")} disabled={z === 1 && !off.x && !off.y}
                  onClick={() => { setZ(1); setOff({ x: 0, y: 0 }); }}><RotateCcw />{t("Reset view")} · {Math.round(z * 100)}%</Button>
        </div>
      </div>
      <div ref={box}
           className={`relative overflow-hidden rounded-lg border bg-muted ${boxClass ?? "h-[calc(var(--app-h)*0.6)] lg:h-[calc(var(--app-h)-11rem)]"} ${z > 1 ? "cursor-grab touch-none" : ""}`}
           onPointerDown={(e) => { if (z > 1) { drag.current = { x: e.clientX - off.x, y: e.clientY - off.y }; (e.target as Element).setPointerCapture?.(e.pointerId); } }}
           onPointerMove={(e) => { if (drag.current) setOff({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }}
           onPointerUp={() => (drag.current = null)}
           onDoubleClick={() => setZ(z > 1 ? 1 : 2.5)}>
        <img src={fileUrl(id)} alt={raw ? t("Answer page {n} (raw capture)", { n: i + 1 }) : t("Answer page {n}", { n: i + 1 })} draggable={false}
             className="h-full w-full select-none object-contain"
             style={{ transform: `translate(${off.x}px, ${off.y}px) scale(${z})`, transformOrigin: "center" }} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{raw ? t("Raw camera capture") : page.kind === "scan" ? t("Scanned page (cropped from the capture)") : t("Original upload")}</span>
        {page.derived_from && <button className="underline" onClick={() => setRaw(!raw)}>{raw ? t("Show the scanned page") : t("Show the raw capture")}</button>}
        <a className="underline" href={fileUrl(id)} target="_blank" rel="noreferrer">{t("Open full size")}</a>
      </div>
    </div>
  );
}
