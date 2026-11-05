import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileUrl, type FileRef } from "@/lib/api";

/** PL-22: the paper large, with zoom, pan and page switch; the raw capture of a scan is one click away (PL-14). */
export default function ImageViewer({ pages }: { pages: FileRef[] }) {
  const [i, setI] = useState(0);
  const [raw, setRaw] = useState(false);
  const [z, setZ] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const page = pages[i];
  const id = raw && page?.derived_from ? page.derived_from : page?.id;

  useEffect(() => { setZ(1); setOff({ x: 0, y: 0 }); }, [i, raw]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && z === 1) return;  // let the page scroll unless zooming
      e.preventDefault();
      setZ((v) => Math.min(6, Math.max(1, v * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [z]);

  if (!page) return <p className="text-sm text-destructive">This answer has no pages.</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {pages.length > 1 && pages.map((p, j) => (
          <Button key={p.id} size="sm" variant={j === i ? "default" : "outline"} onClick={() => setI(j)}>Page {j + 1}</Button>
        ))}
        <div className="ml-auto flex gap-1">
          <Button size="icon" variant="outline" aria-label="Zoom out" disabled={z <= 1} onClick={() => setZ(Math.max(1, z / 1.4))}><Minus /></Button>
          <Button size="icon" variant="outline" aria-label="Zoom in" disabled={z >= 6} onClick={() => setZ(Math.min(6, z * 1.4))}><Plus /></Button>
          <Button size="icon" variant="outline" aria-label="Reset zoom" onClick={() => { setZ(1); setOff({ x: 0, y: 0 }); }}><RotateCcw /></Button>
        </div>
      </div>
      <div ref={box}
           className={`relative h-[60dvh] overflow-hidden rounded-lg border bg-muted lg:h-[calc(100dvh-11rem)] ${z > 1 ? "cursor-grab touch-none" : ""}`}
           onPointerDown={(e) => { if (z > 1) { drag.current = { x: e.clientX - off.x, y: e.clientY - off.y }; (e.target as Element).setPointerCapture?.(e.pointerId); } }}
           onPointerMove={(e) => { if (drag.current) setOff({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }}
           onPointerUp={() => (drag.current = null)}
           onDoubleClick={() => setZ(z > 1 ? 1 : 2.5)}>
        <img src={fileUrl(id)} alt={`Answer page ${i + 1}${raw ? " (raw capture)" : ""}`} draggable={false}
             className="h-full w-full select-none object-contain"
             style={{ transform: `translate(${off.x}px, ${off.y}px) scale(${z})`, transformOrigin: "center" }} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{raw ? "Raw camera capture" : page.kind === "scan" ? "Scanned page (cropped from the capture)" : "Original upload"}</span>
        {page.derived_from && <button className="underline" onClick={() => setRaw(!raw)}>{raw ? "Show the scanned page" : "Show the raw capture"}</button>}
        <a className="underline" href={fileUrl(id)} target="_blank" rel="noreferrer">Open full size</a>
      </div>
    </div>
  );
}
