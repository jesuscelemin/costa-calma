// The landing's loading intro: the logo's sun rising over the waves while the first stretch
// preloads. It plays once per session, only when the session starts on the landing.
//
// An inline script (`introGateScript`) decides before the first paint and marks <html> with
// `data-intro`: "playing" while the overlay covers the page, "lifting" during its fade. CSS shows
// the overlay and fades it out by itself at the maximum, so it never outstays it even if the app's
// JavaScript is late or never arrives; the client only lifts it earlier, once the preload is done.

import { duration } from "./motion";

/** Shortest intro, in ms: long enough to see the sun rise, never a flicker. */
export const INTRO_MIN_MS = 1200;
/** Longest intro before it lifts, in ms, however slow the preload. */
export const INTRO_MAX_MS = 2500;
/** The fade that uncovers the hero, in ms. */
export const INTRO_FADE_MS = duration.slow * 1000;

/** sessionStorage key: set once any page of the site has been opened in this session. */
export const INTRO_SEEN_KEY = "costa-calma:intro-seen";

/** Dispatched on `document` as the intro starts to lift. */
const LIFT_EVENT = "costa-calma:intro-lift";

/** When the intro lifts, in ms since it appeared, for a preload done at `preloadedAt`. */
export function introLiftAt(preloadedAt: number) {
  return Math.min(Math.max(preloadedAt, INTRO_MIN_MS), INTRO_MAX_MS);
}

/**
 * Runs inline before the page paints, so it is stringified: it cannot use anything from outside.
 * The first page of the session marks the intro as seen, so it never plays on a reload nor after
 * arriving through a direct link to another page. Without storage (blocked), no intro at all
 * rather than one on every visit.
 */
function introGate(key: string, maxMs: number) {
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    if (location.pathname !== "/") return;
    const root = document.documentElement;
    root.dataset.intro = "playing";
    root.style.setProperty("--intro-max", `${maxMs}ms`);
  } catch {}
}

/**
 * The same mark from the client, for pages the server does not render whole (Next renders the
 * not-found page on the client in development), where the inline script never runs.
 */
export function markIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {}
}

export const introGateScript = `(${introGate.toString()})(${JSON.stringify(INTRO_SEEN_KEY)}, ${INTRO_MAX_MS})`;

function isPlaying() {
  return document.documentElement.dataset.intro === "playing";
}

/** Resolves as the intro starts to lift, or at once if there is none. */
export function whenIntroLifts() {
  return new Promise<void>((resolve) => {
    if (!isPlaying()) return resolve();
    document.addEventListener(LIFT_EVENT, () => resolve(), { once: true });
  });
}

let holds = 0;
const onUnheld = new Set<() => void>();

/**
 * Holds the intro while something critical for the first stretch loads (the flight's clip), up to
 * its maximum. Returns the release, which is safe to call more than once.
 */
export function holdIntro() {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    if (holds === 0) onUnheld.forEach((resolve) => resolve());
  };
}

function whenUnheld() {
  return new Promise<void>((resolve) => {
    if (holds === 0) return resolve();
    const done = () => {
      onUnheld.delete(done);
      resolve();
    };
    onUnheld.add(done);
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, Math.max(ms, 0)));

/**
 * The page's own critical assets (the hero's poster, the fonts), then every hold. The holds are
 * only counted from the shortest intro on, which the overlay waits for anyway: by then the
 * sections that hydrate after it (the flight, behind the page's own loading boundary) have taken
 * theirs. `elapsed` is the intro's clock.
 */
async function preload(elapsed: () => number) {
  if (document.readyState !== "complete") {
    await new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  }
  await document.fonts.ready;
  await wait(INTRO_MIN_MS - elapsed());
  await whenUnheld();
}

let started = false;

/**
 * Lifts the overlay as soon as the preload allows, within the minimum and maximum, and lets go of
 * the page once it has faded. Its clock is the overlay's own CSS fade, which started with the
 * first paint, so the timing holds however late the app hydrates. It runs once per page load and
 * is not tied to the component: it only ever ends the intro, which is right even if the overlay
 * has gone, and React's development double mount must not start it twice.
 */
export function playIntro(overlay: HTMLElement) {
  if (started || !isPlaying()) return;
  started = true;
  const root = document.documentElement;
  const fade = overlay
    .getAnimations()
    .find(
      (animation) => animation instanceof CSSAnimation && animation.animationName === "intro-lift",
    );
  const elapsed = () => (typeof fade?.currentTime === "number" ? fade.currentTime : INTRO_MAX_MS);

  void (async () => {
    const preloadedAt = await Promise.race([
      preload(elapsed).then(elapsed),
      wait(INTRO_MAX_MS - elapsed()).then(() => INTRO_MAX_MS),
    ]);
    await wait(introLiftAt(preloadedAt) - elapsed());
    // Jump to the start of the fade, unless CSS has already begun it at the maximum.
    if (fade && elapsed() < INTRO_MAX_MS) fade.currentTime = INTRO_MAX_MS;
    root.dataset.intro = "lifting";
    document.dispatchEvent(new Event(LIFT_EVENT));
    await (fade?.finished.catch(() => undefined) ?? Promise.resolve());
    delete root.dataset.intro;
    root.style.removeProperty("--intro-max");
  })();
}
