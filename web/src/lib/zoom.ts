/** PL-39: page zoom with CSS `zoom` on <html> (a page cannot set the browser's own zoom).
 * --zoom lets heights use the real screen: calc((100dvh - footer) / var(--zoom)). Per browser. */
export const ZOOMS = [0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const KEY = "primgrade.zoom";

function saved(): number {
  try {
    const z = Number(localStorage.getItem(KEY));
    if (ZOOMS.includes(z)) return z;
  } catch { /* storage blocked: start at 100% */ }
  return 1;
}

let zoom = saved();

function paint() {
  const root = document.documentElement;
  root.style.zoom = String(zoom);
  root.style.setProperty("--zoom", String(zoom));
}

export const getZoom = () => zoom;

export function setZoom(next: number) {
  zoom = next;
  paint();
  try { localStorage.setItem(KEY, String(next)); } catch { /* per-browser convenience only */ }
}

paint();
