/**
 * Web only: colours the page's drifting glows (public/index.html) from the day's photo. Colours and
 * never the photo's layout, so the background can't hint at where a piece goes.
 */
export function tintBackdrop(glows: readonly string[]) {
  const backdrop = document.getElementById('backdrop');
  if (!backdrop) return;
  glows.forEach((rgb, i) => backdrop.style.setProperty(`--glow-${i + 1}`, rgb));
  backdrop.classList.add('tinted');
}
