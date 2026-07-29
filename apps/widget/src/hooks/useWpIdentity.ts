import { useCallback, useEffect, useState } from "react";
import type { WpWidgetContext } from "@mpe-chatbot/shared";

declare global {
  interface Window {
    /** Injected by the mpe-chatbot WP companion plugin on page load for logged-in
     * visitors (see wp-plugin/mpe-chatbot/includes/class-mpe-context-injector.php),
     * or set manually via the dev mock-login flow in demo.html. */
    mpeChatbotContext?: WpWidgetContext;
  }
}

/** Tracks the visitor's WP identity context and proactively refreshes the short-lived
 * token before it expires via a same-origin browser->WP call (cookie+nonce auth). */
export function useWpIdentity() {
  const [context, setContext] = useState<WpWidgetContext | undefined>(() => window.mpeChatbotContext);

  const refresh = useCallback(async () => {
    const ctx = window.mpeChatbotContext;
    if (!ctx?.loggedIn || !ctx.refreshUrl) return;
    try {
      const res = await fetch(ctx.refreshUrl, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as WpWidgetContext;
      window.mpeChatbotContext = data;
      setContext(data);
    } catch {
      // Network hiccup: keep using the current token until it actually expires.
    }
  }, []);

  useEffect(() => {
    if (!context?.loggedIn || !context.expiresAt) return undefined;
    const msUntilRefresh = Math.max(context.expiresAt - Date.now() - 60_000, 5_000);
    const timer = setTimeout(refresh, msUntilRefresh);
    return () => clearTimeout(timer);
  }, [context, refresh]);

  /** Used by the demo.html dev-login flow to inject a context without a real WP page. */
  const setContextManually = useCallback((ctx: WpWidgetContext) => {
    window.mpeChatbotContext = ctx;
    setContext(ctx);
  }, []);

  return { context, setContextManually };
}
