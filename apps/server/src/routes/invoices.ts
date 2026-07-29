import { Router } from "express";
import { env } from "../config/env.js";
import { verifyToken } from "../auth/token.js";
import { getWpAdapter } from "../adapters/wp/index.js";
import { generateInvoicePdf } from "../invoices/generatePdf.js";
import type { InvoiceDownloadTokenPayload } from "../adapters/invoice/index.js";

export const invoicesRouter = Router();

invoicesRouter.get("/:token", async (req, res) => {
  const result = verifyToken<InvoiceDownloadTokenPayload>(req.params.token, env.WP_SHARED_SECRET);
  if (!result.ok) {
    res.status(410).json({ error: "invoice_link_expired_or_invalid" });
    return;
  }

  const { orderId, userId, wpToken } = result.payload;

  try {
    const invoiceData = await getWpAdapter().getInvoiceData({ userId, token: wpToken }, orderId);
    const pdf = await generateInvoicePdf(invoiceData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${invoiceData.orderNumber}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(404).json({ error: "invoice_not_available", message: (err as Error).message });
  }
});
