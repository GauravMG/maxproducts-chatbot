import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),

  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  WP_MODE: z.enum(["mock", "live"]).default("mock"),
  WP_SITE_URL: z.string().url().default("https://maxpowereu.com"),
  WP_REST_NAMESPACE: z.string().default("mpe-chatbot/v1"),
  WP_SHARED_SECRET: z.string().min(16),

  WC_CONSUMER_KEY: z.string().optional().default(""),
  WC_CONSUMER_SECRET: z.string().optional().default(""),

  INVOICE_STRATEGY: z.enum(["backend_pdf", "wp_plugin_url"]).default("backend_pdf"),

  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  TOKEN_TTL_SECONDS: z.coerce.number().int().default(900),
  // NOT z.coerce.boolean() — Boolean("false") is `true` in JS (any non-empty string is
  // truthy), so that would silently ignore an explicit ENABLE_DEV_AUTH=false and leave
  // the dev-only mock-login route enabled. Parse the actual string value instead.
  ENABLE_DEV_AUTH: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v.toLowerCase() === "true" || v === "1"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
