/**
 * End-to-end journeys against a production build + firehouse_e2e (seeded in global setup).
 * Covers brief Tests 1, 2, 4/5/6 (prepared food through the UI), 11, 13, 16 (persistence after reload).
 */
import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { config } from "dotenv";

const env = config({ path: ".env.e2e", override: true }).parsed ?? {};
const USER_PW = env.SEED_USER_PASSWORD!;
const ADMIN_PW = env.SEED_ADMIN_PASSWORD!;

function scenarioTuesday(): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const d = new Date(`${today}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 2);
  return d.toISOString().slice(0, 10);
}

async function slotId(date: string, period: string): Promise<string> {
  const c = new Client({ connectionString: env.DATABASE_URL });
  await c.connect();
  const r = await c.query(`SELECT id FROM "MealSlot" WHERE date = $1 AND period = $2`, [date, period]);
  await c.end();
  return r.rows[0].id;
}

/** Lane card located by its heading (cards sit inside the "Requirements" region). */
function lane(page: Page, title: string) {
  return page.locator(`[data-lane="${title}"]`);
}

async function login(page: Page, username: string, password: string, as: "user" | "admin" = "user") {
  await page.goto(`/login?as=${as}`);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function chooseSolo(page: Page) {
  await page.waitForURL("**/context");
  await page.getByRole("button", { name: /Volunteer solo/ }).click();
  await page.waitForURL("**/calendar**");
}

test("Test 1-2: volunteer logs in, picks Solo, sees the calendar with three meals per day", async ({ page }) => {
  await login(page, "sam", USER_PW);
  await chooseSolo(page);
  await expect(page.getByText("Status legend").or(page.getByRole("list", { name: "Status legend" }))).toBeVisible();
  await expect(page.getByText(/Breakfast/).first()).toBeVisible();
  await expect(page.getByText(/Dinner/).first()).toBeVisible();
});

test("Test 1: wrong password shows a generic error", async ({ page }) => {
  await login(page, "sam", "definitely-wrong");
  await expect(page.locator("p[role=alert]")).toContainText("Invalid username or password.");
});

test("Tests 5-6, 16: partial 60 then completion by a second user turns prepared food gray and persists", async ({ page, browser }) => {
  const T = scenarioTuesday();
  const slot = await slotId(T, "LUNCH");
  await login(page, "sam", USER_PW);
  await chooseSolo(page);
  await page.goto(`/meals/${slot}`);
  await page.getByLabel("Servings you will bring").fill("60");
  await page.getByRole("button", { name: "Commit prepared food" }).click();
  const prepared = lane(page, "Prepared food");
  await expect(prepared.locator("[data-status]").first()).toHaveAttribute("data-status", "PARTIAL");
  await expect(prepared).toContainText("60 servings can still be pledged");

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await login(p2, "james", USER_PW);
  await chooseSolo(p2);
  await p2.goto(`/meals/${slot}`);
  await p2.getByLabel("Servings you will bring").fill("60");
  await p2.getByRole("button", { name: "Commit prepared food" }).click();
  await expect(lane(p2, "Prepared food").locator("[data-status]").first()).toHaveAttribute("data-status", "FULL");
  await ctx2.close();

  await page.reload(); // persisted server state, not client memory
  await expect(lane(page, "Prepared food").locator("[data-status]").first()).toHaveAttribute("data-status", "FULL");
});

test("Test 11: serving booking fills the serving lane only", async ({ page }) => {
  const T = scenarioTuesday();
  const slot = await slotId(T, "DINNER");
  await login(page, "aisha", USER_PW);
  await chooseSolo(page);
  await page.goto(`/meals/${slot}`);
  await page.getByRole("tab", { name: /serve/i }).click();
  await page.getByRole("button", { name: "Volunteer to serve" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(lane(page, "Serving").locator("[data-status]").first()).toHaveAttribute("data-status", "FULL");
  await expect(lane(page, "Ingredients").locator("[data-status]").first()).not.toHaveAttribute("data-status", "FULL");
});

test("Test 13: a regular user cannot call admin APIs or open admin pages", async ({ page, baseURL }) => {
  await login(page, "maria", USER_PW);
  await chooseSolo(page);
  const res = await page.request.post(`${baseURL}/api/v1/admin/pantry`, {
    headers: { Origin: baseURL!, "Idempotency-Key": crypto.randomUUID(), "Content-Type": "application/json" },
    data: { name: "Hacked", unitKind: "MASS", displayUnit: "g" },
  });
  expect(res.status()).toBe(403);
  await page.goto("/admin");
  await expect(page).not.toHaveURL(/\/admin$/);
});

test("Test 12: admin signs in and sees the dashboard and pantry", async ({ page }) => {
  await login(page, "admin", ADMIN_PW, "admin");
  await page.waitForURL("**/admin");
  await page.goto("/admin/pantry");
  await expect(page.getByText("Kidney beans")).toBeVisible();
});
