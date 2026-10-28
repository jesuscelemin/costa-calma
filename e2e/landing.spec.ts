import { expect, test } from "@playwright/test";

const sections = [
  { id: "hero", name: "Calma Costa" },
  { id: "vuelo", name: "Vuelo" },
  { id: "tipologias", name: "Tipologías" },
  { id: "ubicacion", name: "Ubicación" },
  { id: "calidades", name: "Calidades" },
  { id: "mapa", name: "Mapa" },
  { id: "visita", name: "Visita" },
];

test("landing shows the seven sections in order, each with its anchor", async ({ page }) => {
  await page.goto("/");

  const ids = await page
    .locator("main > section[id]")
    .evaluateAll((elements) => elements.map((element) => element.id));
  expect(ids).toEqual(sections.map((section) => section.id));

  for (const { id, name } of sections) {
    await expect(page.locator(`#${id}`).getByRole("heading", { name })).toBeAttached();
  }
});

test("landing has no horizontal overflow", async ({ page }) => {
  await page.goto("/");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
