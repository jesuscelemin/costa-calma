import { test as base } from "@playwright/test";

import { INTRO_SEEN_KEY } from "../src/lib/intro";

export { expect, type Locator, type Page } from "@playwright/test";

/**
 * Every test starts mid-session, past the landing's loading intro, so the overlay does not cover
 * what it checks. Tests about the intro itself opt back in with `test.use({ intro: "unseen" })`.
 */
export const test = base.extend<{ intro: "seen" | "unseen" }>({
  intro: ["seen", { option: true }],
  page: async ({ page, intro }, provide) => {
    if (intro === "seen") {
      await page.addInitScript((key) => sessionStorage.setItem(key, "1"), INTRO_SEEN_KEY);
    }
    await provide(page);
  },
});
