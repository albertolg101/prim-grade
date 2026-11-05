import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Page } from "@/lib/api";
import { t } from "@/lib/i18n";

/* PL-13: camera → shutter → detect the page → Use / Retake / Adjust corners, several pages in a row.
   jscanify 1.4.3 (MIT) and its opencv.js are vendored in /vendor/jscanify and loaded on first use. */

type Pt = { x: number; y: number };
type Corners = { topLeftCorner: Pt; topRightCorner: Pt; bottomLeftCorner: Pt; bottomRightCorner: Pt };
type Scanner = {
  findPaperContour(m: unknown): { delete(): void } | null;
  getCornerPoints(c: unknown): Corners;
  extractPaper(img: HTMLCanvasElement, w: number, h: number, c: Corners): HTMLCanvasElement;
};
declare global {
  interface Window { cv: any; jscanify: new () => Scanner } // eslint-disable-line @typescript-eslint/no-explicit-any
}

let loading: Promise<Scanner> | null = null;

function script(src: string) {
  return new Promise<void>((ok, fail) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => fail(new Error(`could not load ${src}`));
    document.head.appendChild(s);
  });
}

function loadScanner(): Promise<Scanner> {
  loading ??= (async () => {
    await script("/vendor/jscanify/opencv.js");
    let cv = window.cv;
    if (cv instanceof Promise) cv = await cv;
    else if (!cv.Mat) await new Promise<void>((ok) => { cv.onRuntimeInitialized = () => ok(); });
    window.cv = cv;
    await script("/vendor/jscanify/jscanify.js");
    return new window.jscanify();
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

const KEYS = ["topLeftCorner", "topRightCorner", "bottomRightCorner", "bottomLeftCorner"] as const;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function detect(scanner: Scanner, canvas: HTMLCanvasElement): Corners {
  const mat = window.cv.imread(canvas);
  try {
    const contour = scanner.findPaperContour(mat);
    const c = contour ? scanner.getCornerPoints(contour) : null;
    if (c && KEYS.every((k) => c[k])) return c;
  } finally {
    mat.delete();
  }
  const w = canvas.width, h = canvas.height, m = 0.08;  // nothing found: start from an inset frame
  return {
    topLeftCorner: { x: w * m, y: h * m }, topRightCorner: { x: w * (1 - m), y: h * m },
    bottomLeftCorner: { x: w * m, y: h * (1 - m) }, bottomRightCorner: { x: w * (1 - m), y: h * (1 - m) },
  };
}

const toBlob = (c: HTMLCanvasElement, type = "image/jpeg") =>
  new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("could not encode image"))), type, 0.92));

async function imageToCanvas(file: Blob) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext("2d")!.drawImage(bmp, 0, 0);
  return c;
}

export default function ScannerDialog({ onPage, onClose, count }: {
  onPage: (p: Page) => void; onClose: () => void; count: number;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const photo = useRef<HTMLInputElement>(null);
  const [scanner, setScanner] = useState<Scanner | null>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off">("starting");
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<{ canvas: HTMLCanvasElement; raw: Blob; url: string; corners: Corners } | null>(null);
  const [adjust, setAdjust] = useState(false);

  useEffect(() => {
    loadScanner().then(setScanner, (e) => setError(t("Page detection is unavailable ({error}); the photo is kept as taken.", { error: e.message })));
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("off");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
        setCamera("on");
      }, () => setCamera("off"));
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const take = async (canvas: HTMLCanvasElement, raw: Blob) => {
    const corners = scanner ? detect(scanner, canvas) : null;
    if (!corners) {  // no detector: keep the photo itself as the page
      onPage({ file: raw, name: `scan-${count + 1}.jpg`, preview: URL.createObjectURL(raw) });
      return;
    }
    setShot({ canvas, raw, url: URL.createObjectURL(raw), corners });
    setAdjust(false);
  };

  const shutter = async () => {
    const v = video.current!;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    await take(c, await toBlob(c));
  };

  const use = async () => {
    const { canvas, raw, corners } = shot!;
    const w = Math.round(Math.max(dist(corners.topLeftCorner, corners.topRightCorner), dist(corners.bottomLeftCorner, corners.bottomRightCorner)));
    const h = Math.round(Math.max(dist(corners.topLeftCorner, corners.bottomLeftCorner), dist(corners.topRightCorner, corners.bottomRightCorner)));
    const page = await toBlob(scanner!.extractPaper(canvas, w, h, corners));
    onPage({ file: page, capture: raw, name: `scan-${count + 1}.jpg`, preview: URL.createObjectURL(page) });
    URL.revokeObjectURL(shot!.url);
    setShot(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-label={t("Scan pages")}>
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="text-sm">{t("Pages scanned: {n}", { n: count })}</span>
        <Button variant="secondary" onClick={onClose}>{t("Done")}</Button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {shot ? (
          <Quad shot={shot} adjust={adjust} onChange={(corners) => setShot({ ...shot, corners })} />
        ) : camera === "off" ? (
          <div className="max-w-sm space-y-3 p-6 text-center">
            <p>{t("The live camera is not available here (it needs HTTPS or camera permission).")}</p>
            <Button onClick={() => photo.current?.click()}>{t("Take a photo")}</Button>
          </div>
        ) : (
          <video ref={video} autoPlay playsInline muted className="max-h-full max-w-full" />
        )}
        <input ref={photo} type="file" accept="image/*" capture="environment" hidden
               onChange={async (e) => {
                 const f = e.target.files?.[0];
                 e.target.value = "";
                 if (f) await take(await imageToCanvas(f), f);
               }} />
      </div>
      {error && <p className="px-4 pb-1 text-center text-xs text-yellow-300">{error}</p>}
      <div className="flex items-center justify-center gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {shot ? (
          <>
            <Button variant="secondary" onClick={() => { URL.revokeObjectURL(shot.url); setShot(null); }}>{t("Retake")}</Button>
            <Button variant="secondary" aria-pressed={adjust} onClick={() => setAdjust(!adjust)}>{adjust ? t("Done adjusting") : t("Adjust corners")}</Button>
            <Button onClick={use}>{t("Use")}</Button>
          </>
        ) : camera === "on" ? (
          <button aria-label={t("Shutter")} onClick={shutter} disabled={!scanner && !error}
                  className="size-16 rounded-full border-4 border-white bg-white/30 active:bg-white disabled:opacity-40" />
        ) : null}
      </div>
    </div>
  );
}

/** The capture with the detected page outline; in adjust mode each corner can be dragged. */
function Quad({ shot, adjust, onChange }: {
  shot: { canvas: HTMLCanvasElement; url: string; corners: Corners }; adjust: boolean; onChange: (c: Corners) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<(typeof KEYS)[number] | null>(null);
  const { width: W, height: H } = shot.canvas;
  const c = shot.corners;
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const r = svg.current!.getBoundingClientRect();
    const s = Math.max(W / r.width, H / r.height);  // preserveAspectRatio="meet"
    const ox = (r.width - W / s) / 2, oy = (r.height - H / s) / 2;
    const x = Math.min(W, Math.max(0, (e.clientX - r.left - ox) * s));
    const y = Math.min(H, Math.max(0, (e.clientY - r.top - oy) * s));
    onChange({ ...c, [drag.current]: { x, y } });
  };
  const handle = Math.max(W, H) / 40;
  return (
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="h-full w-full touch-none" preserveAspectRatio="xMidYMid meet"
         onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}>
      <image href={shot.url} width={W} height={H} />
      <polygon points={KEYS.map((k) => `${c[k].x},${c[k].y}`).join(" ")}
               fill="rgba(250,204,21,0.15)" stroke="#facc15" strokeWidth={handle / 4} />
      {adjust && KEYS.map((k) => (
        <circle key={k} cx={c[k].x} cy={c[k].y} r={handle} fill="#facc15" fillOpacity={0.6} stroke="#fff" strokeWidth={handle / 6}
                className="cursor-grab" onPointerDown={(e) => { drag.current = k; (e.target as Element).setPointerCapture?.(e.pointerId); }} />
      ))}
    </svg>
  );
}
