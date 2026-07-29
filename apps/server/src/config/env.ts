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
  ENABLE_DEV_AUTH: z.coerce.boolean().default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
