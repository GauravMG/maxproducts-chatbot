import type { ActionButton } from "@mpe-chatbot/shared";

/** Executes an ActionButton client-side. Every action requires an explicit click —
 * the widget never auto-navigates on the model's behalf. */
export function runAction(action: ActionButton, apiUrl: string): void {
  switch (action.action) {
    case "open_product":
    case "open_order":
    case "open_url": {
      const url = action.payload.url as string | undefined;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      break;
    }
    case "download_invoice": {
      const rawUrl = action.payload.url as string | undefined;
      if (!rawUrl) break;
      const fullUrl = rawUrl.startsWith("http") ? rawUrl : `${apiUrl}${rawUrl}`;
      window.open(fullUrl, "_blank", "noopener,noreferrer");
      break;
    }
    case "login": {
      const url = action.payload.loginUrl as string | undefined;
      if (url) window.location.href = url;
      break;
    }
  }
}
