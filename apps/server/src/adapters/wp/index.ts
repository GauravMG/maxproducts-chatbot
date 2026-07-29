import { env } from "../../config/env.js";
import { MockWpAdapter } from "./mockAdapter.js";
import { LiveWpAdapter } from "./liveAdapter.js";
import type { WpAdapter } from "./types.js";

let instance: WpAdapter | undefined;

export function getWpAdapter(): WpAdapter {
  if (!instance) {
    instance = env.WP_MODE === "live" ? new LiveWpAdapter() : new MockWpAdapter();
  }
  return instance;
}

export type { WpAdapter, WpIdentityContext, SitePageRecord, ProductRecord, InvoiceData } from "./types.js";
export { WpAdapterError } from "./types.js";
