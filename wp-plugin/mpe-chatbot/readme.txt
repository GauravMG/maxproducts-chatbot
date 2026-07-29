=== MPE Chatbot Connector ===
Requires at least: 5.6
Tested up to: 6.6
Requires PHP: 7.4
Requires plugins: woocommerce
Stable tag: 0.1.0
License: GPLv2 or later

Companion plugin for the Max Power Europe AI chatbot (see the `chatbot` repo this plugin ships in).
It does two things:

1. Injects a short-lived signed identity token (`window.mpeChatbotContext`) into every front-end
   page for logged-in visitors, so the chatbot widget knows who's chatting without a separate
   in-chat login step.
2. Exposes customer-scoped REST endpoints under `mpe-chatbot/v1` (account, addresses, orders,
   invoices) that the chatbot's Express backend calls on the visitor's behalf, authenticated by
   that same signed token.

== Installation ==

1. Copy this folder to `wp-content/plugins/mpe-chatbot/` on your WordPress site.
2. Activate "MPE Chatbot Connector" (requires WooCommerce active).
3. Go to Settings > MPE Chatbot and copy the generated **Shared secret** into the chatbot server's
   `WP_SHARED_SECRET` environment variable (they must match exactly).
4. Set `WP_MODE=live` and `WP_SITE_URL` on the chatbot server, and generate WooCommerce REST API
   keys (WooCommerce > Settings > Advanced > REST API) for `WC_CONSUMER_KEY`/`WC_CONSUMER_SECRET`
   (used only for public catalog reads — products/pages — never for account actions).
5. Either fill in "Widget script URL" + "Chatbot API URL" on the settings page to have this plugin
   auto-embed the widget on every page, or embed it yourself via Divi's Theme Options > Integration
   footer code with:
   `<script src="https://.../mpe-chatbot-widget.js"></script>`
   `<script>window.MpeChatbot.init({ apiUrl: "https://your-chatbot-api.example.com" });</script>`

== Security notes ==

- The shared secret is the only trust anchor between this plugin and the chatbot server — treat it
  like any other API secret (don't commit it, rotate it if leaked).
- Tokens are short-lived (15 minutes by default) and scoped to a single user id; every order/account
  route re-verifies ownership server-side, so a valid token never grants access to another
  customer's data.
- This plugin never transmits the visitor's WordPress password anywhere; the chatbot widget also
  never asks for one.
