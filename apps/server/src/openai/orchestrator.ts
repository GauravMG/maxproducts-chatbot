import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ActionCard, ChatMessageDTO, ChatMode, ProductSummary, StreamEvent } from "@mpe-chatbot/shared";
import { openai } from "./client.js";
import { env } from "../config/env.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import { getModeToolNames, shouldAttachProductList } from "./modes.js";
import { getTool, toOpenAITools, type ToolContext } from "./tools/index.js";
import { prisma } from "../db/prisma.js";
import type { VerifiedWpIdentity } from "../auth/identity.js";

const MAX_TOOL_ROUNDTRIPS = 4;
const HISTORY_TURNS = 20;

interface RunTurnParams {
  sessionId: string;
  wpIdentity?: VerifiedWpIdentity;
  userMessage: string;
  mode: ChatMode;
}

interface AccumulatedToolCall {
  id: string;
  name: string;
  args: string;
}

async function loadHistory(sessionId: string): Promise<ChatCompletionMessageParam[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_TURNS,
  });
  return rows
    .reverse()
    .filter((m) => m.content)
    .map((m) => ({ role: m.role, content: m.content! }) as ChatCompletionMessageParam);
}

/**
 * Runs one full chat turn: streams the model's reply, executes any tool calls it
 * requests (auth-guarding requiresAuth tools before ever calling the handler),
 * loops until the model stops calling tools (capped at MAX_TOOL_ROUNDTRIPS), then
 * persists and yields the final assistant message. Consumed by routes/chat.ts,
 * which forwards each yielded StreamEvent to the widget over SSE.
 */
export async function* runChatTurn(params: RunTurnParams): AsyncGenerator<StreamEvent> {
  const { sessionId, wpIdentity, userMessage, mode } = params;

  await prisma.chatMessage.create({ data: { sessionId, role: "user", content: userMessage } });

  const history = await loadHistory(sessionId);
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(wpIdentity, mode) },
    ...history,
    { role: "user", content: userMessage },
  ];

  const tools = toOpenAITools(getModeToolNames(mode));
  const toolContext: ToolContext = { sessionId, wpIdentity, mode };
  const collectedActionCards: ActionCard[] = [];
  let finalContent = "";

  for (let roundTrip = 0; roundTrip <= MAX_TOOL_ROUNDTRIPS; roundTrip++) {
    let stream;
    try {
      stream = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages,
        tools,
        tool_choice: "auto",
        stream: true,
      });
    } catch (err) {
      yield { type: "error", message: `OpenAI request failed: ${(err as Error).message}` };
      yield { type: "done" };
      return;
    }

    let content = "";
    const toolCallAccum = new Map<number, AccumulatedToolCall>();
    let finishReason: string | null = null;

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta;

      if (delta?.content) {
        content += delta.content;
        yield { type: "token", delta: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const existing = toolCallAccum.get(tc.index) ?? { id: "", name: "", args: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (tc.function?.arguments) existing.args += tc.function.arguments;
          toolCallAccum.set(tc.index, existing);
        }
      }

      if (choice.finish_reason) finishReason = choice.finish_reason;
    }

    if (finishReason !== "tool_calls" || toolCallAccum.size === 0 || roundTrip === MAX_TOOL_ROUNDTRIPS) {
      finalContent = content;
      break;
    }

    const toolCalls = [...toolCallAccum.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, tc]) => tc);

    messages.push({
      role: "assistant",
      content: content || null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.args || "{}" },
      })),
    });

    for (const tc of toolCalls) {
      yield { type: "tool_call_start", toolName: tc.name, toolCallId: tc.id };

      const { resultPayload, ok } = await executeTool(tc, toolContext, wpIdentity, collectedActionCards);

      if (ok && tc.name === "search_products") {
        attachProductListIfNeeded(resultPayload, mode, collectedActionCards);
      }

      yield { type: "tool_call_result", toolCallId: tc.id, toolName: tc.name, ok };
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(resultPayload) });
    }
  }

  const savedMessage = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: "assistant",
      content: finalContent || null,
      actionCards: collectedActionCards.length ? (collectedActionCards as any) : undefined,
    },
  });

  if (collectedActionCards.length) {
    yield { type: "action_cards", cards: collectedActionCards };
  }

  const messageDto: ChatMessageDTO = {
    id: savedMessage.id,
    sessionId,
    role: "assistant",
    content: savedMessage.content,
    actionCards: collectedActionCards.length ? collectedActionCards : undefined,
    createdAt: savedMessage.createdAt.toISOString(),
  };

  yield { type: "message_complete", message: messageDto };
  yield { type: "done" };
}

/**
 * Deterministically decides — from the actual result count and active mode, never from
 * what the model says — whether to attach a clickable product_list card. This is the
 * mechanism that guarantees a narrowed search always surfaces a pickable list in the
 * UI, regardless of whether the model's text response gets it right.
 */
function attachProductListIfNeeded(resultPayload: unknown, mode: ChatMode, collectedActionCards: ActionCard[]): void {
  if (typeof resultPayload !== "object" || resultPayload === null) return;
  const result = resultPayload as { total?: unknown; items?: unknown };
  if (typeof result.total !== "number" || !Array.isArray(result.items)) return;

  if (shouldAttachProductList(mode, result.total)) {
    collectedActionCards.push({ type: "product_list", products: result.items as ProductSummary[] });
  }
}

async function executeTool(
  tc: AccumulatedToolCall,
  toolContext: ToolContext,
  wpIdentity: VerifiedWpIdentity | undefined,
  collectedActionCards: ActionCard[]
): Promise<{ resultPayload: unknown; ok: boolean }> {
  const toolDef = getTool(tc.name);

  if (!toolDef) {
    return { resultPayload: { error: "unknown_tool" }, ok: false };
  }

  if (toolDef.requiresAuth && !wpIdentity) {
    if (!collectedActionCards.some((c) => c.type === "login_prompt")) {
      collectedActionCards.push({
        type: "login_prompt",
        loginUrl: `${env.WP_SITE_URL}/my-account/`,
        message: "Please log in to your account to do this.",
      });
    }
    return { resultPayload: { error: "not_authenticated" }, ok: false };
  }

  let parsedArgs: unknown;
  try {
    parsedArgs = JSON.parse(tc.args || "{}");
  } catch {
    return { resultPayload: { error: "invalid_json_arguments" }, ok: false };
  }

  const validated = toolDef.schema.safeParse(parsedArgs);
  if (!validated.success) {
    return {
      resultPayload: { error: "invalid_arguments", details: validated.error.flatten() },
      ok: false,
    };
  }

  try {
    const result = await toolDef.handler(validated.data, toolContext);
    if (result.actionCard) collectedActionCards.push(result.actionCard);
    return { resultPayload: result.data, ok: true };
  } catch (err) {
    return { resultPayload: { error: "tool_execution_failed", message: (err as Error).message }, ok: false };
  }
}
