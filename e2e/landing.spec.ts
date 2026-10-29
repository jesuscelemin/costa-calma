import { expect, test } from "./fixtures";

const sections = [
  { id: "hero", name: "Vivir frente al Mediterráneo" },
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

test("header controls sit inside the hero frame, not on its edge", async ({ page, isMobile }) => {
  await page.goto("/");

  const frame = await page.locator("#hero > div").boundingBox();
  const header = page.getByRole("banner");
  const controls = [
    await header.getByRole("link", { name: "Costa Calma" }).boundingBox(),
    await header.getByRole("link", { name: "Pedir visita" }).boundingBox(),
    await header
      .getByRole("button", { name: isMobile ? "Abrir menú" : /^Cambiar a modo / })
      .boundingBox(),
  ];

  for (const box of controls) {
    expect(box!.y - frame!.y).toBeGreaterThanOrEqual(12);
    expect(box!.x - frame!.x).toBeGreaterThanOrEqual(12);
    expect(frame!.x + frame!.width - (box!.x + box!.width)).toBeGreaterThanOrEqual(12);
  }
});
