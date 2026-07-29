import type { ChatMode } from "@mpe-chatbot/shared";

/**
 * The core reliability mechanism behind the widget's menu: restrict which tools the
 * model can even call for a given turn, instead of relying on prompt-following alone
 * to pick the right behavior out of the full tool set. `undefined` = no restriction
 * (the "menu" mode / no guided flow selected — today's full general-purpose behavior).
 */
const MODE_TOOLS: Record<ChatMode, readonly string[] | undefined> = {
  menu: undefined,
  search_products: ["search_products"],
  product_details: ["search_products", "get_product_details"],
  website_info: ["search_pages"],
  blogs: ["search_pages"],
  ecommerce: ["search_products", "get_product_details"],
};

// Shared by product_details and ecommerce: what to do once search_products has run,
// depending on how many matches it found. Keeping this in one place ensures both modes
// handle "too many results" the same considered way search_products mode does — this
// exact gap (modes only covering "one match" vs "a few", never "too many") previously
// caused the model to dump a raw text list instead of narrowing, since it had no
// instruction for that case at all.
// Shared across every mode that calls search_products: how to use the sku field. This
// specific gap (SKU text appended to a name query silently returning zero results,
// since query uses full-text search and SKUs aren't indexed) has caused real failures —
// state it explicitly and prominently rather than relying on the tool schema description alone.
const SKU_HANDLING = `If the user gives a SKU or product code (with or without a product name), always pass it via the \`sku\` field — never inside \`query\`. If they give only a name/description with no SKU, use \`query\` (and \`category\`/\`brand\` if relevant) as normal.`;

const RESULT_COUNT_HANDLING = `Based on how many matches search_products returns:
- Exactly one match: immediately call get_product_details for it in the same turn.
- 2 to 8 matches: do NOT call get_product_details yet — briefly mention there are a few options in one short sentence (the system shows a clickable list below your reply) and wait for the user to pick one. Do not describe the individual matches yourself.
- More than 8 matches: do NOT call get_product_details and do NOT list individual products. Instead ask ONE clarifying question built directly from the \`facets\` field in the tool result — name the actual top 3-4 categories (or brands) and their counts, e.g. "I found 62 tools — want to narrow by category? Cordless Power Tools (62), Drills & Fastening (12), Saws & Cutters (5)?" Never respond with a vague "here are some options" when you haven't actually shown any — either narrow with real facet data, or ask what they're looking for.
- No matches: say so plainly rather than guessing or inventing one.`;

const MODE_INSTRUCTIONS: Record<ChatMode, string> = {
  menu: "",
  search_products: `You are in PRODUCT SEARCH mode. Only search_products is available to you — get_product_details does not exist in this mode, never attempt to call it, and never claim you "couldn't find" a product without having actually called search_products with the right arguments first. On EVERY user message in this mode, call search_products at least once — including the very first, generic message that just starts this flow (e.g. "I'd like to search for products"), even with no filters at all. Calling it with no filters returns the whole catalog's facets (categories, brands, price range), which is exactly what you need to open with a helpful question. ${SKU_HANDLING} Ask ONE clarifying question using the returned facets when there are many results, e.g. "What are you looking for? You can browse by category — Cordless Power Tools (62), Drills & Fastening (12)... — or just tell me a product name." Once results are narrowed to a manageable set (1 to 8 matches, including exactly 1 — even a single exact match), reply with ONLY a short sentence like "Here's what I found — click 'View details' below to see the full product page." Nothing else: no price, no stock status, no SKU, no image, no markdown links or image tags — the clickable card below your reply already shows all of that, repeating any of it in text is a mistake even for a single match. If the user asks for full details on something already shown earlier in this conversation, you still can't fetch details directly in this mode — just point them to the "View details" button on that item (search_products again first if you need to re-confirm it, e.g. by its sku).`,
  product_details: `You are in PRODUCT DETAILS mode. If the user hasn't named or described a specific product yet (e.g. their message was just a generic opener like "I'd like to see details for a specific product"), ask them which product they mean before calling anything. Once they've named or described one, call search_products to find matching product(s). ${SKU_HANDLING} ${RESULT_COUNT_HANDLING}`,
  website_info: `You are in WEBSITE INFO mode. Only use search_pages to answer questions about the site's content, policies, shipping/returns, and company info. If the user's message is just a generic opener with no actual question yet, ask what they'd like to know rather than searching for nothing.`,
  blogs: `You are in BLOG SEARCH mode. Only use search_pages (already restricted to blog posts) to find and summarize relevant articles. If the user's message is just a generic opener with no topic yet, ask what topic or kind of article they're interested in rather than searching for nothing.`,
  ecommerce: `You are helping the user find a specific product to purchase. On EVERY user message in this mode, call search_products at least once — including the very first, generic message that just starts this flow (e.g. "I'd like to buy a product"), even with no filters at all. Calling it with no filters returns the whole catalog's facets (categories, brands, price range), which is exactly what you need to open with a helpful question, the same way product search mode does. ${SKU_HANDLING} ${RESULT_COUNT_HANDLING} Once they've settled on one product and you've shown its card, that's the one to open and buy — the card includes a button to open the real product page.`,
};

export function getModeToolNames(mode: ChatMode): readonly string[] | undefined {
  return MODE_TOOLS[mode];
}

export function getModeInstructions(mode: ChatMode): string {
  return MODE_INSTRUCTIONS[mode];
}

const PRODUCT_LIST_MAX = 8;

/**
 * Whether a search_products result should get a clickable product_list card attached
 * automatically — a deterministic, code-level decision (result count + active mode),
 * never left to the model to decide whether/when to show one.
 */
export function shouldAttachProductList(mode: ChatMode, total: number): boolean {
  if (mode === "search_products") return total >= 1 && total <= PRODUCT_LIST_MAX;
  if (mode === "product_details" || mode === "ecommerce") return total >= 2 && total <= PRODUCT_LIST_MAX;
  return false;
}
