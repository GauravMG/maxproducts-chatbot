import { Router } from "express";
import { z } from "zod";
import type { StreamEvent } from "@mpe-chatbot/shared";
import { getOrCreateSession, syncSessionIdentity } from "../db/session.js";
import { runChatTurn } from "../openai/orchestrator.js";

const chatModeSchema = z.enum(["menu", "search_products", "product_details", "website_info", "blogs", "ecommerce"]);

const chatStreamInput = z.object({
  widgetSessionId: z.string().min(1),
  message: z.string().min(1).max(4000),
  mode: chatModeSchema.default("menu"),
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
