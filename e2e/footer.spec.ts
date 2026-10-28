import { expect, test } from "@playwright/test";

test("the footer says it is a portfolio project and links to GitHub and the code", async ({
  page,
}) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");

  await expect(footer).toContainText(
    "Proyecto de portfolio de Jesús Celemín. Costa Calma es una promotora ficticia.",
  );
  await expect(footer).toContainText("Vivir frente al Mediterráneo, sin prisa.");
  await expect(footer.getByRole("img", { name: "Costa Calma" })).toBeVisible();
  await expect(footer.getByRole("link", { name: /GitHub/ })).toHaveAttribute(
    "href",
    "https://github.com/jesuscelemin",
  );
  await expect(footer.getByRole("link", { name: /Código/ })).toHaveAttribute(
    "href",
    "https://github.com/jesuscelemin/costa-calma",
  );
  await expect(footer.getByRole("link", { name: /LinkedIn/i })).toHaveCount(0);
});

test("footer navigation goes to the landing sections", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("contentinfo").getByRole("navigation");

  await navigation.getByRole("link", { name: "Ubicación" }).click();

  await expect(page).toHaveURL(/#ubicacion$/);
  await expect(
    page.locator("#ubicacion").getByRole("heading", { name: "Ubicación" }),
  ).toBeInViewport();
});
