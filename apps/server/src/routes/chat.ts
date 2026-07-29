import { Router } from "express";
import { z } from "zod";
import type { ChatMessageDTO, StreamEvent } from "@mpe-chatbot/shared";
import { getOrCreateSession, syncSessionIdentity } from "../db/session.js";
import { runChatTurn } from "../openai/orchestrator.js";
import { getTool } from "../openai/tools/index.js";
import { prisma } from "../db/prisma.js";

const chatModeSchema = z.enum(["menu", "search_products", "product_details", "website_info", "blogs", "ecommerce"]);

const chatStreamInput = z.object({
  widgetSessionId: z.string().min(1),
  message: z.string().min(1).max(4000),
  mode: chatModeSchema.default("menu"),
});

const chatActionInput = z.object({
  widgetSessionId: z.string().min(1),
  action: z.literal("view_product_details"),
  productId: z.number().int(),
});

export const chatRouter = Router();

function writeEvent(res: import("express").Response, event: StreamEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

chatRouter.post("/stream", async (req, res) => {
  const parsed = chatStreamInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }

  const { widgetSessionId, message, mode } = parsed.data;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const session = await getOrCreateSession(widgetSessionId);
    await syncSessionIdentity(session.id, req.wpIdentity);

    for await (const event of runChatTurn({
      sessionId: session.id,
      wpIdentity: req.wpIdentity,
      userMessage: message,
      mode,
    })) {
      writeEvent(res, event);
    }
  } catch (err) {
    writeEvent(res, { type: "error", message: (err as Error).message });
    writeEvent(res, { type: "done" });
  } finally {
    res.end();
  }
});

/**
 * Deterministic, non-LLM action — currently just "view this exact product's details".
 * Plain JSON request/response (no streaming, no model call): clicking an item in a
 * product_list card should be instant and 100% reliable, not subject to whatever the
 * model would have decided to do. See ChatActionRequest in packages/shared.
 */
chatRouter.post("/action", async (req, res) => {
  const parsed = chatActionInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }

  const { widgetSessionId, productId } = parsed.data;

  try {
    const session = await getOrCreateSession(widgetSessionId);
    await syncSessionIdentity(session.id, req.wpIdentity);

    const tool = getTool("get_product_details")!;
    const result = await tool.handler(
      { productId },
      { sessionId: session.id, mode: "menu", wpIdentity: req.wpIdentity }
    );

    if (!result.actionCard) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const savedMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: null,
        actionCards: [result.actionCard] as any,
      },
    });

    const message: ChatMessageDTO = {
      id: savedMessage.id,
      sessionId: session.id,
      role: "assistant",
      content: savedMessage.content,
      actionCards: [result.actionCard],
      createdAt: savedMessage.createdAt.toISOString(),
    };

    res.json({ message });
  } catch (err) {
    res.status(500).json({ error: "action_failed", message: (err as Error).message });
  }
});
