/** PL-39: page zoom. A page cannot set the browser's own zoom, so the app scales the root font
 * size: every size in the UI is in rem, so the whole UI grows, while pixel positions stay real
 * (CSS `zoom` broke dropdown placement, which uses on-screen pixels). Kept per browser. */
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
  document.documentElement.style.fontSize = `${zoom * 100}%`;
}

export const getZoom = () => zoom;

export function setZoom(next: number) {
  zoom = next;
  paint();
  try { localStorage.setItem(KEY, String(next)); } catch { /* per-browser convenience only */ }
}

paint();
