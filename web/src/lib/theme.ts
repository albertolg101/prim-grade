import type { Theme } from "./api";

const dark = matchMedia("(prefers-color-scheme: dark)");
let current: Theme = "system";

function paint() {
  const on = current === "dark" || (current === "system" && dark.matches);
  document.documentElement.classList.toggle("dark", on);
}

/** PL-07: follow the system unless the teacher chose light or dark. */
export function applyTheme(t: Theme) {
  current = t;
  paint();
}

dark.addEventListener("change", paint);
paint();
