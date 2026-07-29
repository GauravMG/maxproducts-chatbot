// Black-box security/boundary smoke test against a running server instance.
// Usage: BASE=http://localhost:4000 WP_SHARED_SECRET=... node scripts/security-smoke-test.mjs
//
// Covers: malformed input handling, HMAC token tampering/expiry/wrong-secret rejection,
// cross-customer invoice access, CORS origin allow-listing, and rate limiting. This is a
// deliberately dependency-free script (Node's built-in fetch + crypto) so it can run
// against any environment without installing anything.
//
// Note: the rate-limit check below intentionally exhausts the 30 req/min limiter on
// /api/chat/stream. Leave ~60s before running anything else against /api/chat/stream
// on the same server (e.g. apps/widget/scripts/e2e-smoke-test.mjs), or its requests
// will get legitimately 429'd by this same test having just run.

import { createHmac } from "node:crypto";

const BASE = process.env.BASE || "http://localhost:4000";
const SECRET = process.env.WP_SHARED_SECRET;

if (!SECRET) {
  console.error("Set WP_SHARED_SECRET to the same value the target server is running with.");
  process.exit(1);
}

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${extra ? " -- " + extra : ""}`);
  }
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makeToken(payload, secret = SECRET) {
  const segment = b64url(payload);
  const sig = createHmac("sha256", secret).update(segment).digest("hex");
  return `${segment}.${sig}`;
}
function nowSec() {
  return Math.floor(Date.now() / 1000);
}

async function main() {
  {
    const res = await fetch(`${BASE}/api/health`);
    check("GET /api/health -> 200", res.status === 200);
  }
  {
    const res = await fetch(`${BASE}/api/totally-unknown-route`);
    check("GET unknown route -> 404", res.status === 404);
  }
  {
    const res = await fetch(`${BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hi" }), // missing widgetSessionId
    });
    check("POST /api/chat/stream missing widgetSessionId -> 400", res.status === 400);
  }
  {
    const res = await fetch(`${BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not valid json",
    });
    check("POST /api/chat/stream malformed JSON -> 400 (not a crash)", res.status === 400, `got ${res.status}`);
  }
  {
    const res = await fetch(`${BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgetSessionId: "x", message: "a".repeat(5000) }),
    });
    check("POST /api/chat/stream over-length message -> 400", res.status === 400);
  }
  {
    const valid = makeToken({ uid: 101, email: "a@b.com", name: "A", iat: nowSec(), exp: nowSec() + 900 });
    const [segment, sig] = valid.split(".");
    const tampered = `${segment}.${sig.slice(0, -1)}${sig.slice(-1) === "a" ? "b" : "a"}`;
    const res = await fetch(`${BASE}/api/invoices/${tampered}`);
    check("Tampered token on /api/invoices -> rejected (410)", res.status === 410, `got ${res.status}`);
  }
  {
    const expired = makeToken({ orderId: 5001, userId: 101, wpToken: "x", iat: nowSec() - 1000, exp: nowSec() - 1 });
    const res = await fetch(`${BASE}/api/invoices/${expired}`);
    check("Expired invoice token -> 410", res.status === 410, `got ${res.status}`);
  }
  {
    const wrongSecret = makeToken({ orderId: 5001, userId: 101, wpToken: "x", iat: nowSec(), exp: nowSec() + 300 }, "wrong-secret");
    const res = await fetch(`${BASE}/api/invoices/${wrongSecret}`);
    check("Invoice token signed with wrong secret -> 410", res.status === 410, `got ${res.status}`);
  }
  {
    // userId 101 requesting an order that belongs to userId 102 (mock fixtures)
    const crossCustomer = makeToken({ orderId: 6001, userId: 101, wpToken: "x", iat: nowSec(), exp: nowSec() + 300 });
    const res = await fetch(`${BASE}/api/invoices/${crossCustomer}`);
    check("Forged invoice token for another customer's order -> rejected (404)", res.status === 404, `got ${res.status}`);
  }
  {
    // Assumes WP_MODE=mock (order 5001 / customer 101 are mock fixtures — see
    // adapters/wp/fixtures/customers.ts). Against WP_MODE=live without the companion
    // plugin installed, this legitimately 404s instead — that's correct, not a failure
    // of this script; skip this one check in that case.
    const ownOrder = makeToken({ orderId: 5001, userId: 101, wpToken: "x", iat: nowSec(), exp: nowSec() + 300 });
    const res = await fetch(`${BASE}/api/invoices/${ownOrder}`);
    check(
      "Correctly-scoped token for own order -> 200 PDF (WP_MODE=mock only)",
      res.status === 200 && res.headers.get("content-type") === "application/pdf",
      `got ${res.status} ${res.headers.get("content-type")}`
    );
  }
  {
    const res = await fetch(`${BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-MPE-Token": "garbage.notatoken" },
      body: JSON.stringify({ widgetSessionId: "sec-test-garbage-token", message: "hello" }),
    });
    check("Garbage X-MPE-Token doesn't crash the request -> 200 (SSE starts)", res.status === 200, `got ${res.status}`);
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
  }
  {
    const res = await fetch(`${BASE}/api/health`, { headers: { Origin: "https://maxpowereu.com" } });
    const allow = res.headers.get("access-control-allow-origin");
    check("Allowed origin gets ACAO header echoing it", allow === "https://maxpowereu.com", `got ${allow}`);
  }
  {
    const res = await fetch(`${BASE}/api/health`, { headers: { Origin: "https://evil-attacker.example" } });
    const allow = res.headers.get("access-control-allow-origin");
    check("Disallowed origin does NOT get an ACAO header", allow === null, `got ${allow}`);
  }
  {
    const requests = Array.from({ length: 32 }, () =>
      fetch(`${BASE}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "missing session id -> fast 400, still counts against the limiter" }),
      })
    );
    const statuses = (await Promise.all(requests)).map((r) => r.status);
    check("Hitting /api/chat 32x rapidly triggers a 429 somewhere", statuses.includes(429), `statuses: ${statuses.join(",")}`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
