import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ActionCard, ChatMessageDTO, ChatMode, ProductFacets, StreamEvent } from "@mpe-chatbot/shared";
import { openai } from "./client.js";
import { env } from "../config/env.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import { getModeToolNames } from "./modes.js";
import { getTool, toOpenAITools, type ToolContext } from "./tools/index.js";
import { prisma } from "../db/prisma.js";
import type { VerifiedWpIdentity } from "../auth/identity.js";

const MAX_TOOL_ROUNDTRIPS = 4;
const HISTORY_TURNS = 20;
const PRODUCT_LIST_MAX = 8;
// Every guided mode that calls search_products.
const PRODUCT_SEARCH_MODES: readonly ChatMode[] = ["search_products", "product_details", "ecommerce"];

/**
 * gpt-4o-mini reliably ignores the "more than 8 matches: ask one clarifying question,
 * don't list them" instruction in modes.ts's RESULT_COUNT_HANDLING — verified by direct
 * testing, it dumps a raw numbered list of SKUs regardless of the prompt wording. With no
 * deterministic UI card anymore (removed in favor of fully conversational text, per
 * product decision), that overwhelming dump is now the entire user-facing result, so this
 * one case is composed server-side instead of trusted to the model — still plain
 * conversational text, just reliably correct instead of a coin flip.
 */
function buildFacetClarifyingQuestion(
  total: number,
  facets: ProductFacets,
  applied: { categoryAlreadySet: boolean; brandAlreadySet: boolean }
): string {
  // computeFacets always returns the full category/brand breakdown regardless of which
  // filters are already applied (so switching filters is possible) — but that means it's
  // not safe to just take facets.categories at face value: if the user already picked a
  // category, re-offering the full category list (including ones they just excluded)
  // reads as if their choice was ignored. Only offer a dimension that isn't already fixed.
  const categoryOption = !applied.categoryAlreadySet && facets.categories.length ? facets.categories.slice(0, 4) : null;
  const brandOption = !applied.brandAlreadySet && facets.brands.length ? facets.brands.slice(0, 4) : null;
  const source = categoryOption ?? brandOption;

  if (!source) {
    return `I found ${total} matches — that's still a lot to show at once. Can you tell me a bit more about what you're looking for — a specific name, feature, or price range?`;
  }
  const label = categoryOption ? "category" : "brand";
  const breakdown = source.map((f) => `${f.name} (${f.count})`).join(", ");
  return `I found ${total} matches — want to narrow it down by ${label}? ${breakdown}. Or just tell me more specifically what you're looking for.`;
}

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

    let overwhelmingResultText: string | null = null;

    for (const tc of toolCalls) {
      yield { type: "tool_call_start", toolName: tc.name, toolCallId: tc.id };

      const { resultPayload, ok } = await executeTool(tc, toolContext, wpIdentity, collectedActionCards);

      yield { type: "tool_call_result", toolCallId: tc.id, toolName: tc.name, ok };
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(resultPayload) });

      if (
        ok &&
        tc.name === "search_products" &&
        !overwhelmingResultText &&
        PRODUCT_SEARCH_MODES.includes(mode) &&
        typeof resultPayload === "object" &&
        resultPayload !== null
      ) {
        const result = resultPayload as { total?: unknown; facets?: ProductFacets };
        if (typeof result.total === "number" && result.total > PRODUCT_LIST_MAX && result.facets) {
          let appliedArgs: { category?: unknown; brand?: unknown } = {};
          try {
            appliedArgs = JSON.parse(tc.args || "{}");
          } catch {
            // malformed args JSON — treat as no filters known, still safe to ask generically
          }
          overwhelmingResultText = buildFacetClarifyingQuestion(result.total, result.facets, {
            categoryAlreadySet: Boolean(appliedArgs.category),
            brandAlreadySet: Boolean(appliedArgs.brand),
          });
        }
      }
    }

    if (overwhelmingResultText) {
      yield { type: "token", delta: overwhelmingResultText };
      finalContent = overwhelmingResultText;
      break;
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
