import { Router } from "express";
import { z } from "zod";
import type { WpWidgetContext } from "@mpe-chatbot/shared";
import { env } from "../config/env.js";
import { issueToken } from "../auth/token.js";
import { MOCK_CUSTOMERS, findMockCustomer } from "../adapters/wp/fixtures/customers.js";

const mockLoginInput = z.object({ userId: z.number().int().optional() });

/**
 * Dev-only stand-in for the WP companion plugin's token issuance (§ wp-plugin/mpe-chatbot).
 * Lets the widget demo the full authenticated flow — login, addresses, orders, invoices —
 * without any real WordPress instance. Only mounted when ENABLE_DEV_AUTH=true; never enable
 * this in a deployment that talks to real customer data.
 */
export const devAuthRouter = Router();

devAuthRouter.get("/mock-users", (_req, res) => {
  res.json({
    users: MOCK_CUSTOMERS.map((c) => ({ userId: c.userId, name: c.name, email: c.email })),
  });
});

devAuthRouter.post("/mock-login", (req, res) => {
  const parsed = mockLoginInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  const userId = parsed.data.userId ?? MOCK_CUSTOMERS[0].userId;
  const customer = findMockCustomer(userId);
  if (!customer) {
    res.status(404).json({ error: "unknown_mock_user" });
    return;
  }

  const token = issueToken(
    { uid: customer.userId, email: customer.email, name: customer.name },
    env.WP_SHARED_SECRET,
    env.TOKEN_TTL_SECONDS
  );

  const context: WpWidgetContext = {
    loggedIn: true,
    token,
    expiresAt: Date.now() + env.TOKEN_TTL_SECONDS * 1000,
  };
  res.json(context);
});
