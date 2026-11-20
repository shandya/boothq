import { type Browser, expect, type Page, test } from "@playwright/test";

const PINS = { Admin: "111111", Illustrator: "222222" } as const;

async function logIn(page: Page, role: keyof typeof PINS): Promise<void> {
  await page.goto("/login");
  await page.getByText(role, { exact: true }).click();
  for (const digit of PINS[role]) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.waitForURL(role === "Admin" ? "**/admin" : "**/illustrator");
}

async function newContextPage(browser: Browser, baseURL: string | undefined, use: object): Promise<Page> {
  const context = await browser.newContext({ ...use, baseURL });
  return context.newPage();
}

// The whole happy path on a 375px phone: Admin opens the booth and creates a
// ticket, the customer opens their private link, the Illustrator calls,
// starts and finishes it, and the customer's page follows along.
test("open booth → ticket → call → start → finish, customer follows", async ({ browser, baseURL, contextOptions }, testInfo) => {
  test.setTimeout(120_000);
  const use = { ...testInfo.project.use, ...contextOptions };
  const admin = await newContextPage(browser, baseURL, use);
  const illustrator = await newContextPage(browser, baseURL, use);
  const customer = await newContextPage(browser, baseURL, use);

  // Admin opens the booth.
  await logIn(admin, "Admin");
  await admin.getByRole("button", { name: "Open Booth" }).click();
  await admin.getByRole("button", { name: "Open Booth" }).last().click();
  await expect(admin.getByRole("button", { name: "+ New Ticket" })).toBeVisible();

  // Admin creates a ticket and shows its QR.
  await admin.getByRole("button", { name: "+ New Ticket" }).click();
  await admin.getByLabel("Name", { exact: true }).fill("Dewi Lestari");
  await admin.getByLabel("Phone", { exact: true }).fill("081234567890");
  const created = admin.waitForResponse((res) => res.url().endsWith("/api/tickets") && res.request().method() === "POST");
  await admin.getByRole("button", { name: "Create Ticket & Show QR" }).click();
  const body = (await (await created).json()) as { ticket: { customerUrl: string } };
  await expect(admin.getByText("Done", { exact: true })).toBeVisible();
  await admin.getByText("Done", { exact: true }).click();

  // The customer opens the private link: first name and number only.
  const customerPath = new URL(body.ticket.customerUrl).pathname;
  await customer.goto(customerPath);
  await expect(customer.getByText("#1").first()).toBeVisible();
  await expect(customer.getByText("Dewi").first()).toBeVisible();
  await expect(customer.getByText("Lestari")).toHaveCount(0);
  await expect(customer.getByText("081234567890")).toHaveCount(0);

  // The illustrator calls the customer; their page shows the takeover.
  await logIn(illustrator, "Illustrator");
  await illustrator.getByRole("button", { name: /^Call #1/ }).click();
  await expect(customer.getByText("It's your turn!")).toBeVisible({ timeout: 25_000 });
  await customer.getByRole("button", { name: "OK" }).click();

  // Start drawing, then finish.
  await illustrator.getByRole("button", { name: "Start Drawing" }).click();
  await expect(illustrator.getByText("Drawing for").first()).toBeVisible();
  await illustrator.getByRole("button", { name: "Finish", exact: true }).click();

  // The customer's page thanks them and the illustrator's queue is empty again.
  await expect(customer.getByText("Thanks for visiting!")).toBeVisible({ timeout: 25_000 });
  await expect(illustrator.getByText("No one waiting")).toBeVisible();
});
