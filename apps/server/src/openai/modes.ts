import type { ChatMode } from "@mpe-chatbot/shared";

/**
 * The core reliability mechanism behind the widget's menu: restrict which tools the
 * model can even call for a given turn, instead of relying on prompt-following alone
 * to pick the right behavior out of the full tool set. `undefined` = no restriction
 * (the "menu" mode / no guided flow selected — today's full general-purpose behavior).
 */
const MODE_TOOLS: Record<ChatMode, readonly string[] | undefined> = {
  menu: undefined,
  search_products: ["search_products", "get_product_details"],
  product_details: ["search_products", "get_product_details"],
  website_info: ["search_pages"],
  blogs: ["search_pages"],
  ecommerce: ["search_products", "get_product_details"],
};

// Shared across every mode that calls search_products: how to use the sku field. This
// specific gap (SKU text appended to a name query silently returning zero results,
// since query uses full-text search and SKUs aren't indexed) has caused real failures —
// state it explicitly and prominently rather than relying on the tool schema description alone.
const SKU_HANDLING = `If the user gives a SKU or product code (with or without a product name), always pass it via the \`sku\` field — never inside \`query\`. If they give only a name/description with no SKU, use \`query\` (and \`category\`/\`brand\` if relevant) as normal.`;

// Shared by every mode that calls search_products: what to do once it's run, depending
// on the result. There is deliberately no UI card/button for the multi-match case — the
// model is the one describing results, in natural conversational text, using only the
// exact data the tool returned (never inventing a detail that isn't there). Also covers
// the "found nothing" case: prefer surfacing `suggestions` (typo-corrected or filter-
// relaxed near-matches) over a flat dead end.
const RESULT_COUNT_HANDLING = `Never include a markdown image (\`![...](...)\`) in your reply — the widget doesn't render those, they show up as broken-looking raw text. Describe products in plain sentences only. Based on what search_products returns:
- Exactly one match: call get_product_details for it in the same turn, then talk about it in a natural sentence or two using only the data returned (name, price, key attributes) — like a helpful salesperson, not a spec dump. The card that appears already shows the image and a "View product page" button, so don't repeat a link yourself.
- 2 to 8 matches: describe them in a short, natural paragraph or list, using the EXACT names, prices, and SKUs from the tool result — never guess or invent a detail that isn't in the data. Invite the user to ask for more on any one of them, or to narrow further. Don't call get_product_details yet unless the user has already named a specific one from the list.
- More than 8 matches: don't list individual products. Ask ONE clarifying question built directly from the \`facets\` field in the tool result — name the actual top 3-4 categories (or brands) and their counts, e.g. "I found 62 tools — want to narrow by category? Cordless Power Tools (62), Drills & Fastening (12), Saws & Cutters (5)?"
- No matches, but the result has a non-empty \`suggestions\` field: say plainly that there's no exact match for what they asked, then mention 2-3 of the suggested products by name as the closest things we actually carry — these are either near-name matches (likely a typo) or the same request with a filter like brand/price relaxed. Let the user decide if one of those works.
- No matches and no \`suggestions\`: say so plainly — we genuinely don't have anything close — rather than guessing or inventing one.`;

const MODE_INSTRUCTIONS: Record<ChatMode, string> = {
  menu: "",
  search_products: `You are in PRODUCT SEARCH mode, helping the user browse and narrow down the catalog conversationally — like a knowledgeable salesperson talking through options, not a search box dumping a list. On EVERY user message in this mode, call search_products at least once — including the very first, generic message that just starts this flow (e.g. "I'd like to search for products"), even with no filters at all. Calling it with no filters returns the whole catalog's facets (categories, brands, price range), which is exactly what you need to open with a helpful question. ${SKU_HANDLING} ${RESULT_COUNT_HANDLING} If the user then asks for more detail on something you've already mentioned, call get_product_details for it (search_products again first if you need to pin down exactly which one, e.g. by name or sku).`,
  product_details: `You are in PRODUCT DETAILS mode. If the user hasn't named or described a specific product yet (e.g. their message was just a generic opener like "I'd like to see details for a specific product"), ask them which product they mean before calling anything. Once they've named or described one, call search_products to find matching product(s). ${SKU_HANDLING} ${RESULT_COUNT_HANDLING}`,
  website_info: `You are in WEBSITE INFO mode. Only use search_pages to answer questions about the site's content, policies, shipping/returns, and company info. If the user's message is just a generic opener with no actual question yet, ask what they'd like to know rather than searching for nothing.`,
  blogs: `You are in BLOG SEARCH mode. Only use search_pages (already restricted to blog posts) to find and summarize relevant articles. If the user's message is just a generic opener with no topic yet, ask what topic or kind of article they're interested in rather than searching for nothing.`,
  ecommerce: `You are helping the user find a specific product to purchase, talking them through it naturally rather than just listing items. On EVERY user message in this mode, call search_products at least once — including the very first, generic message that just starts this flow (e.g. "I'd like to buy a product"), even with no filters at all. Calling it with no filters returns the whole catalog's facets (categories, brands, price range), which is exactly what you need to open with a helpful question, the same way product search mode does. ${SKU_HANDLING} ${RESULT_COUNT_HANDLING} Once they've settled on one product and you've pulled up its details, that's the one to buy — mention that its card includes a button to open the real product page and complete the purchase there.`,
};

export function getModeToolNames(mode: ChatMode): readonly string[] | undefined {
  return MODE_TOOLS[mode];
}

export function getModeInstructions(mode: ChatMode): string {
  return MODE_INSTRUCTIONS[mode];
}
