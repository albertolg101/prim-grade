import type React from "react";

/** Hovering a control slides its cut-off label back and forth so it can be read in full (Button,
 * SelectTrigger). It moves a `.truncate` or select-value line inside the control; the CSS lives in
 * index.css (`[data-marquee]`), and reduced motion turns it off. */
const LABELS = ".truncate, [data-slot=select-value]";

export function marqueeOn(e: React.PointerEvent<HTMLElement>) {
  for (const el of e.currentTarget.querySelectorAll<HTMLElement>(LABELS)) {
    const over = el.scrollWidth - el.clientWidth;
    if (over <= 0) continue;
    el.style.setProperty("--marquee-shift", `${over}px`);
    el.style.setProperty("--marquee-time", `${Math.max(2, over / 25)}s`);  // ~25 px/s, never rushed
    el.dataset.marquee = "";
  }
}

export function marqueeOff(e: React.PointerEvent<HTMLElement>) {
  for (const el of e.currentTarget.querySelectorAll<HTMLElement>("[data-marquee]")) delete el.dataset.marquee;
}
