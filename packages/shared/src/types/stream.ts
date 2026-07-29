import type { ActionCard, ChatMessageDTO } from "./chat.js";

export type StreamEvent =
  | { type: "token"; delta: string }
  | { type: "tool_call_start"; toolName: string; toolCallId: string }
  | { type: "tool_call_result"; toolCallId: string; toolName: string; ok: boolean }
  | { type: "action_cards"; cards: ActionCard[] }
  | { type: "message_complete"; message: ChatMessageDTO }
  | { type: "error"; message: string }
  | { type: "done" };
