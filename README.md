# MPE Chatbot

An AI chatbot for a WooCommerce store (built against [maxpowereu.com](https://maxpowereu.com) as the
reference site), embeddable on a WordPress/Divi page. It can:

- Answer questions about site content (pages, policies, categories, blog posts).
- Help shoppers find products via guided, conversational narrowing (asks clarifying
  questions by brand/category/price instead of dumping search results).
- Let a logged-in dealer manage their own account: billing/shipping addresses, account
  details, order history, and invoice downloads.
- Trigger real UI actions from chat — open a product page, download an invoice — via
  clickable action cards, never silent auto-navigation.

Stack: **Express + TypeScript**, **React + TypeScript**, **PostgreSQL**, **Prisma**, **Docker**,
**OpenAI** (`gpt-4o-mini`, tool/function calling).

## Status: mock mode by default

There's no WordPress admin access wired up yet, so the whole system runs by default against a
**mock WordPress/WooCommerce adapter** with realistic fixture data (products, pages, dealer
accounts/orders) — fully self-contained, no real WordPress instance required. A companion
**WordPress plugin** (`wp-plugin/mpe-chatbot/`) is included and ready to install for when real
credentials are available; switching from mock to live is a config change, not a code change.
See [Switching to a live WordPress site](#switching-to-a-live-wordpress-site) below.

## Architecture

```
apps/server        Express + TS API — OpenAI orchestration, WP adapters, Postgres search, invoices
apps/widget         React + TS embeddable chat widget (Vite IIFE build + local demo harness)
packages/shared      Wire types + zod tool schemas shared by both apps
wp-plugin/mpe-chatbot  Companion WordPress plugin (identity tokens + customer-scoped REST API)
```

### How identity works (the interesting part)

The chat widget lives on the same page as a WordPress visitor who might already be logged in —
but Express runs on a different origin and never sees their WP session cookie. The companion
plugin solves this by minting a **short-lived HMAC-signed token** (`window.mpeChatbotContext`)
for logged-in visitors on every page load; the widget sends it on every request (`X-MPE-Token`),
and Express verifies it **statelessly** (same shared secret both sides, no DB/network round trip
needed just to know who's chatting). When an account tool needs real data, Express calls the
plugin's own REST routes with that same token; the plugin independently re-verifies it and scopes
every WooCommerce call to that user — a token never grants access to another customer's data.
The chat **never** asks for a username or password — if you're not logged in, tool calls return
`not_authenticated` and the widget shows a login button instead.

### Search without a vector DB

Site pages and products are synced into Postgres and searched with native **full-text search**
(generated `tsvector` columns + GIN indexes, `ts_rank`/`websearch_to_tsquery`) plus structured/JSONB
filters for products (category, price, brand, attributes). `search_products` also returns a
`facets` breakdown (category/brand counts, price range) that the model uses to ask one good
clarifying question instead of listing 40 results.

### Tool-calling & action cards

The model gets a fixed set of tools (`search_pages`, `search_products`, `get_product_details`,
`get_account_details`, `update_account_details`, `get_addresses`, `update_address`, `list_orders`,
`get_order_details`, `get_invoice`). Tools that resolve a specific entity attach a structured
**action card** (product/order/address/login-prompt/buttons) alongside the streamed text reply —
the widget renders these as buttons the user has to click; nothing ever navigates automatically.

## Local setup

Requirements: Docker + Docker Compose, an OpenAI API key.

```bash
cp .env.example .env
# edit .env: set OPENAI_API_KEY, and generate a real WP_SHARED_SECRET (any long random string)
docker compose up --build
```

This starts:

| Service      | URL                     | What it is                                   |
|--------------|-------------------------|-----------------------------------------------|
| `postgres`   | localhost:5433          | Database (mapped to 5433 to avoid clashing with a local Postgres on 5432) |
| `adminer`    | http://localhost:8080   | DB admin UI (server: `postgres`, user/pass from `.env`) |
| `server`     | http://localhost:4000   | Express API — applies Prisma migrations automatically on boot |
| `widget-dev` | http://localhost:5173/demo.html | The chat widget running in a standalone test page |

Then seed the mock catalog and site content into Postgres:

```bash
pnpm install                 # host-side, needed for the CLI scripts below
pnpm --filter @mpe-chatbot/shared build
DATABASE_URL="postgresql://chatbot:chatbot@localhost:5433/chatbot" \
  OPENAI_API_KEY=sk-... WP_SHARED_SECRET=... \
  pnpm sync:pages
DATABASE_URL="postgresql://chatbot:chatbot@localhost:5433/chatbot" \
  OPENAI_API_KEY=sk-... WP_SHARED_SECRET=... \
  pnpm sync:products
```

Open **http://localhost:5173/demo.html** — it simulates the WordPress page the widget will
eventually live on, with buttons to simulate a dealer login (via the server's dev-only
`/api/dev/mock-login` route) so you can test addresses/orders/invoices without any real WordPress.

### Running without Docker (tighter dev loop)

```bash
pnpm install
pnpm --filter @mpe-chatbot/shared build
pnpm dev   # runs server (tsx watch) + widget (vite) in parallel
```
Point `DATABASE_URL` in `.env` at `localhost:5433` (or your own local Postgres) either way.

## Environment variables

See `.env.example` for the full list with inline comments. Key ones:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` / `OPENAI_MODEL` | OpenAI credentials + model (default `gpt-4o-mini`) |
| `WP_MODE` | `mock` (default, self-contained) or `live` (real WooCommerce + the WP plugin) |
| `WP_SITE_URL`, `WP_SHARED_SECRET` | Live-mode target site + the secret shared with the WP plugin |
| `WC_CONSUMER_KEY` / `WC_CONSUMER_SECRET` | Store-wide WooCommerce REST API keys — **read-only catalog data only** (products/pages), never used for account actions |
| `INVOICE_STRATEGY` | `backend_pdf` (default — Express renders the PDF itself) or `wp_plugin_url` (delegate to a WP invoice plugin) |
| `ENABLE_DEV_AUTH` | Enables `/api/dev/mock-login` for local testing. **Never enable this in a real deployment.** |

## Switching to a live WordPress site

1. Copy `wp-plugin/mpe-chatbot/` to `wp-content/plugins/mpe-chatbot/` on the target site and
   activate it (requires WooCommerce active).
2. Go to **Settings → MPE Chatbot** on the WP admin and copy the generated shared secret.
3. Set on the chatbot server: `WP_MODE=live`, `WP_SITE_URL=https://your-site.com`,
   `WP_SHARED_SECRET=<the same value>`, and generate WooCommerce REST API keys
   (WooCommerce → Settings → Advanced → REST API) for `WC_CONSUMER_KEY`/`WC_CONSUMER_SECRET`.
4. Re-run `pnpm sync:pages` / `pnpm sync:products` — they now pull from the real site.
5. Either fill in "Widget script URL" + "Chatbot API URL" on the plugin's settings page to
   auto-embed the widget on every page, or embed it yourself, e.g. via Divi's
   **Theme Options → Integration → footer code**:
   ```html
   <script src="https://your-cdn.example.com/mpe-chatbot-widget.js"></script>
   <script>window.MpeChatbot.init({ apiUrl: "https://your-chatbot-api.example.com" });</script>
   ```
   Build that bundle with `pnpm --filter @mpe-chatbot/widget build` (outputs
   `apps/widget/dist/mpe-chatbot-widget.js`).
6. Set `ENABLE_DEV_AUTH=false` (or just omit it) once real login is in play.

Invoices: the default `backend_pdf` strategy needs nothing extra. To use an existing WP invoice
plugin instead, set `INVOICE_STRATEGY=wp_plugin_url` — the plugin auto-detects WooCommerce PDF
Invoices & Packing Slips or YITH's invoice plugin, or you can hook the `mpe_chatbot_invoice_url`
filter yourself (see `wp-plugin/mpe-chatbot/includes/class-mpe-invoice.php`).

## Testing

**Unit + integration tests** (44 tests, run against the real dockerized Postgres — no mocking of
the DB layer):
```bash
cd apps/server
DATABASE_URL=... OPENAI_API_KEY=... WP_SHARED_SECRET=... pnpm test
```
Covers: the HMAC token issue/verify round-trip (incl. expiry/tampering/wrong-secret rejection),
the mock WP adapter's business logic (account/address/order/invoice behavior, cross-customer
ownership checks), Postgres full-text/facet search (incl. SQL-injection resistance checks),
PDF invoice generation, the tool registry (schema validation, requiresAuth flags), and the full
tool-handler chain (list_orders → get_order_details → get_invoice, with audit log writes).

**Security/boundary smoke test** (black-box, against a running server — no mocking):
```bash
BASE=http://localhost:4000 WP_SHARED_SECRET=... node apps/server/scripts/security-smoke-test.mjs
```
Covers: malformed/oversized request bodies, tampered/expired/wrong-secret tokens, forged
cross-customer invoice access attempts, CORS origin allow-listing, and rate limiting. Note: the
rate-limit check exhausts the 30 req/min limiter on `/api/chat/stream` — leave ~60s before running
anything else against that endpoint on the same server.

**Browser E2E smoke test** (Playwright, against `demo.html`):
```bash
npm install --no-save playwright-core   # one-time, not a project dependency
cd apps/widget
CHROME_PATH=/usr/bin/google-chrome WIDGET_URL=http://localhost:5173/demo.html \
  node scripts/e2e-smoke-test.mjs
```
Covers: input validation, XSS-safety of user-supplied message text, network-failure resilience,
the anonymous → login-prompt-card flow (with click-through navigation), and multi-turn
authenticated session identity continuity.

All three suites were run clean against a `docker compose down -v && docker compose up --build`
from-scratch rebuild during development — including cross-verifying that the PHP plugin's HMAC
token implementation (`wp-plugin/mpe-chatbot/includes/class-mpe-auth.php`) and the TypeScript one
(`apps/server/src/auth/token.ts`) produce byte-for-byte identical tokens and can verify each
other's output (no PHP install needed for this — see the `php:8.2-cli` Docker approach if you want
to re-check it after modifying either implementation).

## Known limitations

- Single-store scoping only; no multi-tenant support.
- No vector DB — search is Postgres full-text + structured filters, which works well for a
  catalog this size but won't scale to semantic search over huge unstructured content.
- Identity tokens are 15 minutes by default (`TOKEN_TTL_SECONDS` / the plugin's Token TTL
  setting) — both sides must agree on the same value.
- `docker compose` here targets **local development only**; there's no production deployment
  config (TLS termination, process manager, image hardening) included yet.
- The widget's product-narrowing quality depends on the model actually following the system
  prompt's instructions (see `apps/server/src/openai/systemPrompt.ts`) — it's been tuned against
  real `gpt-4o-mini` behavior during development, but isn't a hard guarantee for every phrasing.
