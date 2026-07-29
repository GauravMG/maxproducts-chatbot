import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ActionCard, ChatMode } from "@mpe-chatbot/shared";
import type { VerifiedWpIdentity } from "../../auth/identity.js";

export interface ToolContext {
  sessionId: string;
  wpIdentity?: VerifiedWpIdentity;
  mode: ChatMode;
}

export interface ToolResult {
  data: unknown;
  actionCard?: ActionCard;
}

export interface ToolDefinition<TInput = any> {
  name: string;
  description: string;
  requiresAuth: boolean;
  schema: z.ZodType<TInput>;
  handler: (input: TInput, ctx: ToolContext) => Promise<ToolResult>;
}

const registry = new Map<string, ToolDefinition>();

export function registerTool<T>(tool: ToolDefinition<T>): void {
  registry.set(tool.name, tool as ToolDefinition);
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return [...registry.values()];
}

/** @param allowedNames Restricts the returned tool-calling schema to this subset (mode-scoping
 * — see openai/modes.ts). Omit for the full set (used outside any guided mode). */
export function toOpenAITools(allowedNames?: readonly string[]) {
  const tools = allowedNames ? getAllTools().filter((t) => allowedNames.includes(t.name)) : getAllTools();
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.schema, { target: "openApi3", $refStrategy: "none" }),
    },
  }));
}
