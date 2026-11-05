/** Hovering a control slides its cut-off label to its end and back, so it can be read in full. One
 * listener for the whole page, so every button, link, select, option and tag gets it; the label is a
 * `.truncate` (or select-value) line inside the control. It scrolls the label (a CSS text-indent
 * animation was not repainted by Chrome); reduced motion turns it off. */
const CONTROLS = "button, a, [role=combobox], [role=option], [data-slot=badge]";
const LABELS = ".truncate, [data-slot=select-value]";
const SPEED = 80;  // px/s
const HOLD = 500;  // ms at each end
let current: Element | null = null;
let frame = 0;

const ease = (x: number) => (1 - Math.cos(Math.PI * x)) / 2;

function start(control: Element) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const labels = ([control, ...control.querySelectorAll(LABELS)] as HTMLElement[])
    .filter((el) => el.matches(LABELS) && el.scrollWidth > el.clientWidth);
  if (!labels.length) return;
  labels.forEach((el) => { el.dataset.marquee = ""; });  // no "…" while it moves (index.css)
  const t0 = performance.now();
  const tick = (now: number) => {
    for (const el of labels) {
      const over = el.scrollWidth - el.clientWidth;
      const move = Math.max(800, (over / SPEED) * 1000);
      const u = (now - t0) % (2 * (HOLD + move));
      el.scrollLeft = over * (u < HOLD ? 0 : u < HOLD + move ? ease((u - HOLD) / move)
        : u < 2 * HOLD + move ? 1 : 1 - ease((u - 2 * HOLD - move) / move));
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}

function stop() {
  cancelAnimationFrame(frame);
  current?.querySelectorAll<HTMLElement>("[data-marquee]").forEach((el) => { delete el.dataset.marquee; el.scrollLeft = 0; });
  if (current instanceof HTMLElement && "marquee" in current.dataset) { delete current.dataset.marquee; current.scrollLeft = 0; }
  current = null;
}

document.addEventListener("pointerover", (e) => {
  const control = (e.target as Element).closest?.(CONTROLS) ?? null;
  if (control === current) return;
  stop();
  current = control;
  if (control) start(control);
});
document.addEventListener("pointerout", (e) => { if (!e.relatedTarget) stop(); });  // left the window
