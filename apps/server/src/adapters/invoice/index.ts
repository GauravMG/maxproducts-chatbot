import { env } from "../../config/env.js";
import { getWpAdapter } from "../wp/index.js";
import { BackendPdfInvoiceStrategy } from "./backendPdfStrategy.js";
import { WpPluginUrlInvoiceStrategy } from "./wpPluginUrlStrategy.js";
import type { InvoiceStrategy } from "./types.js";

let instance: InvoiceStrategy | undefined;

export function getInvoiceStrategy(): InvoiceStrategy {
  if (!instance) {
    const wpAdapter = getWpAdapter();
    instance =
      env.INVOICE_STRATEGY === "wp_plugin_url"
        ? new WpPluginUrlInvoiceStrategy(wpAdapter)
        : new BackendPdfInvoiceStrategy(wpAdapter);
  }
  return instance;
}

export type { InvoiceStrategy, InvoiceResult } from "./types.js";
export type { InvoiceDownloadTokenPayload } from "./backendPdfStrategy.js";
