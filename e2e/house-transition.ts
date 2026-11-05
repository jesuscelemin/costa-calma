import type { Page } from "./fixtures";

import { houseTypeTransitionName } from "../src/features/houses/transition";

import { houseTypeCards, houseTypes, pointAtCard } from "./houses";

/**
 * Whether the suite runs against a production build (`npm run test:e2e:prod`). Only there does Next
 * prefetch links, and a card morphs into its house only if the house renders in the same commit
 * as the navigation, prefetched; without it the house suspends into its loading screen first.
 */
export const prefetches = process.env.E2E_PROD === "1";

/** The pseudo-element that carries a house type's card into its hero, and back. */
export const morphGroup = (slug: string) =>
  `::view-transition-group(${houseTypeTransitionName(slug)})`;

declare global {
  interface Window {
    /** Per view transition, the pseudo-elements it animated (see `recordViewTransitions`). */
    __viewTransitions?: string[][];
    /** Settles once the last view transition has finished and been recorded. */
    __viewTransitionDone?: Promise<unknown>;
    /** Plays on a view transition held by `recordViewTransitions({ freezeAt })`. */
    __thawViewTransition?: () => void;
    /** Total layout shift since `recordLayoutShifts`. */
    __layoutShift?: number;
    /** Every value `<html data-intro>` took since `recordIntro`. */
    __introMarks?: string[];
  }
}

/**
 * From the next document on, records which pseudo-elements each view transition animates, read
 * once it is ready: `::view-transition-group(name)` and friends. With `freezeAt`, a share of the
 * way, each one also stops there until `thawViewTransition`, for a capture of that frame.
 */
export async function recordViewTransitions(page: Page, { freezeAt }: { freezeAt?: number } = {}) {
  await page.addInitScript((freeze) => {
    window.__viewTransitions = [];
    const start = Document.prototype.startViewTransition;
    if (!start) return;
    Document.prototype.startViewTransition = function (
      this: Document,
      ...args: Parameters<Document["startViewTransition"]>
    ) {
      const transition = start.apply(this, args);
      const recorded = transition.ready.then(() => {
        const running = document.getAnimations().flatMap((animation) => {
          const { effect } = animation;
          const pseudo = effect instanceof KeyframeEffect ? effect.pseudoElement : null;
          return pseudo?.startsWith("::view-transition") ? [{ animation, pseudo }] : [];
        });
        window.__viewTransitions?.push(running.map(({ pseudo }) => pseudo));
        if (freeze === null) return;
        for (const { animation } of running) {
          animation.pause();
          const { duration, delay } = animation.effect?.getComputedTiming() ?? {};
          if (typeof duration === "number")
            animation.currentTime = (delay ?? 0) + duration * freeze;
        }
        return new Promise<void>((resolve) => {
          window.__thawViewTransition = () => {
            running.forEach(({ animation }) => animation.play());
            resolve();
          };
        });
      });
      window.__viewTransitionDone = Promise.all([recorded, transition.finished]).catch(
        () => undefined,
      );
      return transition;
    };
  }, freezeAt ?? null);
}

/** Waits for a view transition held by `freezeAt` to stop at its frame. */
export const viewTransitionFrozen = (page: Page) =>
  page.waitForFunction(() => window.__thawViewTransition !== undefined);

/** Lets a held view transition play to its end. */
export const thawViewTransition = (page: Page) =>
  page.evaluate(() => {
    window.__thawViewTransition?.();
    delete window.__thawViewTransition;
  });

/** The pseudo-elements animated by each view transition so far. */
export const viewTransitions = (page: Page) => page.evaluate(() => window.__viewTransitions ?? []);

/**
 * Waits for the last view transition to finish. The URL changes within its update, before it is
 * ready, so a navigation that has changed the URL has already started it.
 */
export const transitionsSettled = (page: Page) => page.evaluate(() => window.__viewTransitionDone);

/** Starts adding up layout shifts in this document, input-driven ones included. */
export const recordLayoutShifts = (page: Page) =>
  page.evaluate(() => {
    window.__layoutShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__layoutShift =
          (window.__layoutShift ?? 0) + (entry as unknown as { value: number }).value;
      }
    }).observe({ type: "layout-shift" });
  });

export const layoutShift = (page: Page) => page.evaluate(() => window.__layoutShift ?? 0);

/** Starts recording every mark the intro leaves on `<html>` in this document. */
export const recordIntro = (page: Page) =>
  page.evaluate(() => {
    window.__introMarks = [];
    new MutationObserver(() => {
      const mark = document.documentElement.dataset.intro;
      if (mark) window.__introMarks?.push(mark);
    }).observe(document.documentElement, { attributeFilter: ["data-intro"] });
  });

export const introMarks = (page: Page) => page.evaluate(() => window.__introMarks ?? []);

/**
 * Opens the landing on the selection and points at the card at `index`, once its page is
 * prefetched (in production): the morph needs the house to render in the same commit as the
 * navigation.
 */
export async function openSelectionAt(page: Page, index: number) {
  const { slug } = houseTypes[index];
  const prefetched =
    prefetches &&
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/casas/${slug}` &&
        response.request().headers().rsc === "1",
    );
  await page.goto("/#tipologias");
  // The whole card in view, as when choosing it: one mostly out of view does not morph.
  await houseTypeCards(page)
    .nth(index)
    .evaluate((card) => card.scrollIntoView({ block: "center", inline: "center" }));
  await pointAtCard(page, index);
  if (prefetched) await prefetched;
  await page.waitForLoadState("networkidle");
}

/**
 * Clicks the middle of the card at `index`, which its link covers, with the mouse where it is: a
 * locator's click would first scroll the card up past the header's scroll margin.
 */
export async function chooseCardAt(page: Page, index: number) {
  const card = await houseTypeCards(page).nth(index).boundingBox();
  if (!card) throw new Error(`Card ${index} is not laid out`);
  await page.mouse.click(card.x + card.width / 2, card.y + card.height / 2);
}
