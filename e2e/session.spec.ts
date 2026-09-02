import { expect, test, type Page } from "@playwright/test";

async function sit(page: Page, seatLabel: "Seat A" | "Seat B") {
  await page.goto("/");
  await page.getByRole("button", { name: seatLabel }).click();
  await expect(page.getByRole("heading", { name: "Decision Wheel" })).toBeVisible();
}

async function addPlace(page: Page, name: string) {
  await page.getByPlaceholder("Thai Garden").fill(name);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
}

test("two seats privately pick, share one spin, and confirm a visit", async ({ browser }) => {
  const suffix = Date.now();
  const thai = `Thai Garden ${suffix}`;
  const pizza = `Pizzeria ${suffix}`;
  const sushi = `Sushi Bar ${suffix}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await sit(pageA, "Seat A");
  await sit(pageB, "Seat B");

  await addPlace(pageA, thai);
  await addPlace(pageA, pizza);
  await addPlace(pageA, sushi);
  await expect(pageB.getByRole("listitem").filter({ hasText: thai })).toBeVisible();
  await expect(pageB.getByTestId("due-banner")).toBeVisible();

  await pageA.getByTestId("start-round").click();
  await expect(pageA.getByText("still choosing")).toHaveCount(2);
  await expect(pageB.getByText("Build the wheel")).toBeVisible();

  await pageA.getByRole("checkbox", { name: new RegExp(thai) }).check();
  await pageA.getByRole("checkbox", { name: new RegExp(pizza) }).check();
  await pageB.getByRole("checkbox", { name: new RegExp(thai) }).check();
  await pageB.getByRole("checkbox", { name: new RegExp(sushi) }).check();

  await expect(pageA.getByTestId("your-ticket-count")).toHaveText("2 tickets on your stub");
  await expect(pageB.getByText(pizza)).toBeVisible();
  await expect(pageB.getByRole("checkbox", { name: new RegExp(pizza) })).not.toBeChecked();

  await pageA.getByTestId("lock-picks").click();
  await expect(pageB.getByText(/locked in/)).toBeVisible();
  await expect(pageB.getByTestId("odds-list")).toHaveCount(0);

  await pageB.getByTestId("lock-picks").click();
  await expect(pageA.getByTestId("odds-list")).toBeVisible();
  await expect(pageB.getByTestId("odds-list")).toContainText("50%");
  await expect(pageA.getByTestId("odds-list")).toContainText(thai);

  await pageA.getByTestId("spin-wheel").click();
  await expect(pageA.getByTestId("confirm-visit")).toBeVisible();
  await expect(pageB.getByTestId("confirm-visit")).toBeVisible();

  const resultA = await pageA.locator(".session h2").last().innerText();
  const resultB = await pageB.locator(".session h2").last().innerText();
  expect(resultA).toBe(resultB);
  expect([thai, pizza, sushi]).toContain(resultA);

  await pageB.getByTestId("confirm-visit").click();
  await expect(pageA.getByRole("heading", { name: "No wheel yet" })).toBeVisible();
  await expect(pageA.locator(".visit-list")).toContainText(resultA);
  await expect(
    pageA.locator(".place-list li").filter({ hasText: resultA }).getByText("Due"),
  ).toHaveCount(0);

  await contextA.close();
  await contextB.close();
});
