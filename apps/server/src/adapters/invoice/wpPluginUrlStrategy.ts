import type { WpAdapter, WpIdentityContext } from "../wp/index.js";
import type { InvoiceResult, InvoiceStrategy } from "./types.js";

/**
 * Delegates to a WP invoice plugin (e.g. WooCommerce PDF Invoices & Packing Slips)
 * exposed via the mpe-chatbot companion plugin's /orders/{id}/invoice-url route.
 * Active when INVOICE_STRATEGY=wp_plugin_url.
 */
export class WpPluginUrlInvoiceStrategy implements InvoiceStrategy {
  constructor(private readonly wpAdapter: WpAdapter) {}

  async getInvoice(identity: WpIdentityContext, orderId: number): Promise<InvoiceResult> {
    const url = await this.wpAdapter.getInvoiceUrl(identity, orderId);
    return { url };
  }
}
