import { env } from "../../config/env.js";
import { issueToken } from "../../auth/token.js";
import type { WpAdapter, WpIdentityContext } from "../wp/index.js";
import type { InvoiceResult, InvoiceStrategy } from "./types.js";

const INVOICE_TOKEN_TTL_SECONDS = 300;

export interface InvoiceDownloadTokenPayload {
  orderId: number;
  userId: number;
  /** The visitor's original WP identity token, carried forward so the download route
   * can re-authenticate with the live adapter without a fresh chat request. Safe to
   * embed: it's already HMAC-signed and short-lived, this just forwards existing access. */
  wpToken: string;
}

/**
 * Default invoice strategy: no WP plugin dependency. Issues a short-lived signed
 * download token (same HMAC scheme as visitor identity tokens, separate purpose)
 * embedding the orderId + userId; GET /api/invoices/:token (routes/invoices.ts)
 * verifies it, re-fetches order data from the WpAdapter, and streams a freshly
 * rendered PDF — nothing is persisted to disk.
 */
export class BackendPdfInvoiceStrategy implements InvoiceStrategy {
  constructor(private readonly wpAdapter: WpAdapter) {}

  async getInvoice(identity: WpIdentityContext, orderId: number): Promise<InvoiceResult> {
    // Validate the order exists and belongs to this customer before minting a download link.
    await this.wpAdapter.getInvoiceData(identity, orderId);

    const payload: InvoiceDownloadTokenPayload = {
      orderId,
      userId: identity.userId,
      wpToken: identity.token,
    };
    const token = issueToken(payload, env.WP_SHARED_SECRET, INVOICE_TOKEN_TTL_SECONDS);
    return {
      url: `/api/invoices/${token}`,
      expiresAt: new Date(Date.now() + INVOICE_TOKEN_TTL_SECONDS * 1000),
    };
  }
}
