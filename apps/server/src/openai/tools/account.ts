import {
  emptyInput,
  listOrdersInput,
  orderIdInput,
  updateAccountDetailsInput,
  updateAddressInput,
  type ActionButton,
} from "@mpe-chatbot/shared";
import type { ActionType, ActionStatus } from "@prisma/client";
import { getWpAdapter, type WpIdentityContext } from "../../adapters/wp/index.js";
import { getInvoiceStrategy } from "../../adapters/invoice/index.js";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { registerTool, type ToolContext } from "./registry.js";

/** requiresAuth:true tools are only ever invoked by the orchestrator after confirming
 * ctx.wpIdentity is set (see openai/orchestrator.ts auth guard) — the `!` here is safe. */
function identity(ctx: ToolContext): WpIdentityContext {
  return { userId: ctx.wpIdentity!.userId, token: ctx.wpIdentity!.token };
}

async function audit(
  ctx: ToolContext,
  actionType: ActionType,
  payload: unknown,
  result: unknown,
  status: ActionStatus
) {
  await prisma.actionAuditLog.create({
    data: {
      sessionId: ctx.sessionId,
      wpUserId: ctx.wpIdentity?.userId,
      actionType,
      payload: payload as any,
      result: result as any,
      status,
    },
  });
}

registerTool({
  name: "get_account_details",
  description: "Get the logged-in dealer's account details (first name, last name, email, phone).",
  requiresAuth: true,
  schema: emptyInput,
  handler: async (_input, ctx) => {
    const account = await getWpAdapter().getAccountDetails(identity(ctx));
    return { data: account };
  },
});

registerTool({
  name: "update_account_details",
  description:
    "Update the logged-in dealer's account details. Pass only the fields being changed (firstName, lastName, email, phone).",
  requiresAuth: true,
  schema: updateAccountDetailsInput,
  handler: async (input, ctx) => {
    try {
      const account = await getWpAdapter().updateAccountDetails(identity(ctx), input);
      await audit(ctx, "update_account", input, account, "success");
      return { data: account };
    } catch (err) {
      await audit(ctx, "update_account", input, { error: (err as Error).message }, "failure");
      throw err;
    }
  },
});

registerTool({
  name: "get_addresses",
  description: "Get the logged-in dealer's billing and shipping addresses.",
  requiresAuth: true,
  schema: emptyInput,
  handler: async (_input, ctx) => {
    const addresses = await getWpAdapter().getAddresses(identity(ctx));
    return { data: addresses };
  },
});

registerTool({
  name: "update_address",
  description:
    "Update the logged-in dealer's billing or shipping address. Requires the full new address (all fields), not a partial patch. Always confirm the new address back to the user.",
  requiresAuth: true,
  schema: updateAddressInput,
  handler: async (input, ctx) => {
    const actionType: ActionType =
      input.type === "billing" ? "update_billing_address" : "update_shipping_address";
    try {
      const address = await getWpAdapter().updateAddress(identity(ctx), input.type, input.address);
      await audit(ctx, actionType, input, address, "success");
      return {
        data: address,
        actionCard: { type: "address_confirmation", addressType: input.type, address },
      };
    } catch (err) {
      await audit(ctx, actionType, input, { error: (err as Error).message }, "failure");
      throw err;
    }
  },
});

registerTool({
  name: "list_orders",
  description: "List the logged-in dealer's past orders, most recent first.",
  requiresAuth: true,
  schema: listOrdersInput,
  handler: async (input, ctx) => {
    const result = await getWpAdapter().listOrders(identity(ctx), input.page ?? 1, input.pageSize ?? 10);
    return { data: result };
  },
});

registerTool({
  name: "get_order_details",
  description:
    "Get full details for one order (line items, totals, addresses), e.g. after the user picks one from list_orders, or asks to see/open an order. Attaches an order card with 'view order' and 'download invoice' buttons.",
  requiresAuth: true,
  schema: orderIdInput,
  handler: async (input, ctx) => {
    const order = await getWpAdapter().getOrderDetails(identity(ctx), input.orderId);
    const actions: ActionButton[] = [
      {
        id: "open",
        label: "View order",
        action: "open_order",
        payload: { orderId: order.id, url: `${env.WP_SITE_URL}/my-account/view-order/${order.id}/` },
      },
      {
        id: "invoice",
        label: "Download invoice",
        action: "download_invoice",
        payload: { orderId: order.id },
      },
    ];
    return { data: order, actionCard: { type: "order", order, actions } };
  },
});

registerTool({
  name: "get_invoice",
  description: "Get a download link for an order's invoice PDF.",
  requiresAuth: true,
  schema: orderIdInput,
  handler: async (input, ctx) => {
    try {
      const invoice = await getInvoiceStrategy().getInvoice(identity(ctx), input.orderId);
      await audit(ctx, "download_invoice", input, invoice, "success");
      const actions: ActionButton[] = [
        {
          id: "download",
          label: "Download invoice",
          action: "download_invoice",
          payload: { orderId: input.orderId, url: invoice.url },
        },
      ];
      return { data: invoice, actionCard: { type: "action_buttons", buttons: actions } };
    } catch (err) {
      await audit(ctx, "download_invoice", input, { error: (err as Error).message }, "failure");
      throw err;
    }
  },
});
