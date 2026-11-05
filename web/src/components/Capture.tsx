import { lazy, Suspense, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Page } from "@/lib/api";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ScannerDialog = lazy(() => import("./Scanner"));
const OK = ["image/jpeg", "image/png", "image/webp"];

/** PL-12: browse, drag and drop, or scan. The pages are shown, in order, before anything is sent. */
export default function Capture({ pages, onChange, disabled }: {
  pages: Page[]; onChange: (p: Page[]) => void; disabled?: boolean; label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const latest = useRef(pages);
  latest.current = pages;

  const add = (files: FileList | File[]) => {
    const list = Array.from(files);
    const bad = list.filter((f) => !OK.includes(f.type));
    setRefused(bad.length ? t("Not added (use JPG, PNG or WebP): {files}", { files: bad.map((f) => f.name).join(", ") }) : null);
    const next = list.filter((f) => OK.includes(f.type)).map((f) => ({ file: f, name: f.name, preview: URL.createObjectURL(f) }));
    onChange([...latest.current, ...next]);
  };
  const moveBy = (i: number, d: number) => {
    const p = [...pages];
    [p[i], p[i + d]] = [p[i + d], p[i]];
    onChange(p);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) add(e.dataTransfer.files); }}
        className={cn("flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-4 text-center transition-colors",
          over ? "border-primary bg-primary/10" : "border-border")}>
        <p className="hidden text-sm text-muted-foreground sm:block">{t("Drop images here, or")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
            <Upload /> {t("Browse files")}
          </Button>
          <Button type="button" disabled={disabled} onClick={() => setScanning(true)}>
            <Camera /> {t("Scan")}
          </Button>
        </div>
        <input ref={input} type="file" multiple accept={OK.join(",")} hidden
               onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
      </div>
      {refused && <p className="text-sm text-destructive">{refused}</p>}
      {pages.length > 0 && (
        <ol className="flex gap-2 overflow-x-auto pb-1" aria-label={t("Pages to send: {n}", { n: pages.length })}>
          {pages.map((p, i) => (
            <li key={p.preview} className="relative w-24 shrink-0 overflow-hidden rounded-md border bg-muted">
              <img src={p.preview} alt={t("Page {n}", { n: i + 1 })} className="h-32 w-full object-cover" />
              <div className="flex items-center justify-between bg-background/90 px-1 text-xs">
                <span>{i + 1}{p.capture ? ` · ${t("scan")}` : ""}</span>
                <span className="flex">
                  <button type="button" aria-label={t("Move left")} disabled={i === 0} className="disabled:opacity-30" onClick={() => moveBy(i, -1)}><ChevronLeft className="size-4" /></button>
                  <button type="button" aria-label={t("Move right")} disabled={i === pages.length - 1} className="disabled:opacity-30" onClick={() => moveBy(i, 1)}><ChevronRight className="size-4" /></button>
                </span>
              </div>
              <button type="button" aria-label={t("Remove page {n}", { n: i + 1 })} onClick={() => onChange(pages.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5"><X className="size-3.5" /></button>
            </li>
          ))}
        </ol>
      )}
      {scanning && (
        <Suspense fallback={null}>
          <ScannerDialog count={pages.length} onClose={() => setScanning(false)}
                         onPage={(p) => onChange([...latest.current, p])} />
        </Suspense>
      )}
    </div>
  );
}
