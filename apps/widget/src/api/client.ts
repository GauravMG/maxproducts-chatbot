import type { ChatMessageDTO, ChatMode, StreamEvent } from "@mpe-chatbot/shared";

export interface StreamChatOptions {
  apiUrl: string;
  widgetSessionId: string;
  message: string;
  mode: ChatMode;
  token?: string;
  onEvent: (event: StreamEvent) => void;
  signal?: AbortSignal;
}

/** POSTs to /api/chat/stream and parses the text/event-stream response by hand
 * (EventSource doesn't support POST bodies, so we read the fetch body stream directly). */
export async function streamChat(opts: StreamChatOptions): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers["X-MPE-Token"] = opts.token;

  let res: Response;
  try {
    res = await fetch(`${opts.apiUrl}/api/chat/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ widgetSessionId: opts.widgetSessionId, message: opts.message, mode: opts.mode }),
      signal: opts.signal,
    });
  } catch (err) {
    opts.onEvent({ type: "error", message: `Could not reach the assistant: ${(err as Error).message}` });
    opts.onEvent({ type: "done" });
    return;
  }

  if (!res.ok || !res.body) {
    opts.onEvent({ type: "error", message: `Request failed (${res.status})` });
    opts.onEvent({ type: "done" });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      try {
        const event = JSON.parse(dataLine.slice(5).trim()) as StreamEvent;
        opts.onEvent(event);
      } catch {
        // ignore malformed chunk
      }
    }
  }
}

/** Calls the deterministic, non-LLM POST /api/chat/action endpoint — used when the
 * user clicks a specific item in a product_list card. Plain JSON, no streaming, no
 * model round trip: instant and always correct, unlike asking the model to fetch it. */
export async function fetchProductDetailsAction(
  apiUrl: string,
  widgetSessionId: string,
  productId: number
): Promise<ChatMessageDTO> {
  const res = await fetch(`${apiUrl}/api/chat/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgetSessionId, action: "view_product_details", productId }),
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  const data = (await res.json()) as { message: ChatMessageDTO };
  return data.message;
}

const SESSION_STORAGE_KEY = "mpe_chatbot_session_id";

export function getOrCreateWidgetSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

/** Starts a genuinely fresh server-side session (new ChatSession row, no prior message
 * history sent to the model) — used by the widget's "New chat" control. The session id
 * persists across page reloads by design (so a visitor can navigate the site mid-conversation
 * without losing context), so an explicit reset is the only way to fully start over. */
export function resetWidgetSessionId(): string {
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, id);
  } catch {
    // localStorage unavailable (private browsing etc.) — the in-memory id below still works
    // for the rest of this page view, it just won't persist across a reload.
  }
  return id;
}
