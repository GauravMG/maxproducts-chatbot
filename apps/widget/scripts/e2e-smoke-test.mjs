// Browser E2E smoke test for the widget, driven via Playwright against a running
// `demo.html` + server instance. Not wired into `pnpm test` by default since it needs
// a real Chrome/Chromium binary and the `playwright-core` package — install ad hoc:
//
//   npm install --no-save playwright-core
//   CHROME_PATH=/usr/bin/google-chrome WIDGET_URL=http://localhost:5173/demo.html \
//     node scripts/e2e-smoke-test.mjs
//
// Covers: input validation, XSS-safety of user-supplied text, network-failure
// resilience, the anonymous -> login-prompt-card flow, and multi-turn authenticated
// session identity continuity.

import { chromium } from "playwright-core";

const WIDGET_URL = process.env.WIDGET_URL || "http://localhost:5173/demo.html";
const CHROME_PATH = process.env.CHROME_PATH || "/usr/bin/google-chrome";

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${extra ? " -- " + extra : ""}`);
  }
}

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });

async function freshPage() {
  const context = await browser.newContext({ viewport: { width: 500, height: 750 } });
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));
  return { context, page };
}

async function openChat(page) {
  await page.goto(WIDGET_URL, { waitUntil: "networkidle" });
  const root = page.locator("#mpe-chatbot-root");
  await root.locator(".mpe-launcher").click();
  await page.waitForTimeout(200);
  return root;
}

// 1. Empty input can't be sent
{
  const { context, page } = await freshPage();
  const root = await openChat(page);
  check("Send button disabled when input is empty", await root.locator(".mpe-send-btn").isDisabled());
  await context.close();
}

// 2. XSS safety
{
  const { context, page } = await freshPage();
  const root = await openChat(page);
  await page.evaluate(() => (window.__xssFired = false));
  const input = root.locator(".mpe-input");
  await input.fill('<img src=x onerror="window.__xssFired=true">');
  await input.press("Enter");
  await page.waitForTimeout(4000);
  const fired = await page.evaluate(() => window.__xssFired);
  check("User-supplied HTML/script in a message never executes", fired === false, `__xssFired=${fired}`);
  const bubbleText = await root.locator(".mpe-bubble.user").first().textContent();
  check("The literal text is still shown (escaped, not executed)", bubbleText.includes("<img"), bubbleText);
  await context.close();
}

// 3. Network failure resilience
{
  const { context, page } = await freshPage();
  const root = await openChat(page);
  await page.route("**/api/chat/stream", (route) => route.abort("connectionrefused"));
  const input = root.locator(".mpe-input");
  await input.fill("hello");
  await input.press("Enter");
  await page.waitForTimeout(2000);
  check("Simulated network failure surfaces an error banner instead of hanging", (await root.locator(".mpe-error-banner").count()) > 0);
  await context.close();
}

// 4. Anonymous account request -> login prompt card -> click navigates
{
  const { context, page } = await freshPage();
  const root = await openChat(page);
  const input = root.locator(".mpe-input");
  await input.fill("What's on my last order?");
  await input.press("Enter");
  await page.waitForSelector("text=Login required", { timeout: 25000 }).catch(() => null);
  const loginBtn = root.locator(".mpe-card button", { hasText: "Log in" });
  check("Login prompt card + button appears for an anonymous account request", (await loginBtn.count()) > 0);
  if ((await loginBtn.count()) > 0) {
    const navPromise = page.waitForURL(/my-account/, { timeout: 5000 }).catch(() => null);
    await loginBtn.first().click();
    check("Clicking 'Log in' navigates to the WP login/account URL", (await navPromise) !== null, page.url());
  }
  await context.close();
}

// 5. Multi-turn authenticated identity continuity
{
  const { context, page } = await freshPage();
  await page.goto(WIDGET_URL, { waitUntil: "networkidle" });
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), page.click("text=Login as Freya (dealer)")]);
  const root = page.locator("#mpe-chatbot-root");
  await root.locator(".mpe-launcher").click();
  await page.waitForTimeout(200);
  const input = root.locator(".mpe-input");

  async function waitForNthAssistantReply(n, timeout = 25000) {
    await page
      .waitForFunction(
        (count) => {
          const els = document.querySelector("#mpe-chatbot-root").shadowRoot.querySelectorAll(".mpe-bubble.assistant");
          return els.length >= count && els[count - 1].textContent.trim().length > 0;
        },
        n,
        { timeout }
      )
      .catch(() => null);
  }

  await input.fill("What's my name on file?");
  await input.press("Enter");
  await waitForNthAssistantReply(1);
  await input.fill("And what's my phone number?");
  await input.press("Enter");
  await waitForNthAssistantReply(2);
  await page.waitForTimeout(500);

  const bubbles = await root.locator(".mpe-bubble.assistant").allTextContents();
  check(
    "Multi-turn authenticated conversation resolves the correct dealer identity",
    bubbles.some((t) => /Freya|Nilsen/i.test(t)),
    bubbles.join(" | ")
  );
  await context.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);
