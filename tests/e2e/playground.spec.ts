import { expect, test } from "@playwright/test";

test("runs the required Worker examples without evaluation network traffic", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/");
  await expect(page.getByText("Runtime ready")).toBeVisible();

  const evaluationRequests: string[] = [];
  page.on("request", (request) => evaluationRequests.push(request.url()));
  await page.getByRole("button", { name: "Scalar arithmetic" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("2");
  expect(evaluationRequests).toEqual([]);

  await page.getByRole("button", { name: "Vector mean" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("3");

  await page.getByRole("button", { name: "Function + closure" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("16");
  expect(pageErrors).toEqual([]);
});

test("surfaces recycling warnings and reset clears assigned state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Runtime ready")).toBeVisible();
  await page.getByRole("button", { name: "Recycling warning" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[11, 22, 13]");
  await expect(page.locator("#warnings")).toContainText("NRW1001");

  await page.getByRole("button", { name: "JavaScript assignment" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("2.5");
  await page.getByRole("button", { name: "Reset session" }).click();
  await page.getByRole("button", { name: "Scalar arithmetic" }).click();
  await page.locator("#source").fill("mean(x)");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#errors")).toContainText("NRE2001");
});
