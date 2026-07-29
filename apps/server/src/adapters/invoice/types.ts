import type { WpIdentityContext } from "../wp/index.js";

export interface InvoiceResult {
  url: string;
  expiresAt?: Date;
}

export interface InvoiceStrategy {
  getInvoice(identity: WpIdentityContext, orderId: number): Promise<InvoiceResult>;
}
