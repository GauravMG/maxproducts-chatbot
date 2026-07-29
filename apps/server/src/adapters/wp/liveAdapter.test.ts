import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "./liveAdapter.js";

describe("decodeHtmlEntities", () => {
  it("decodes common named entities", () => {
    expect(decodeHtmlEntities("Grinding &amp; Sanding &amp; Polishing")).toBe("Grinding & Sanding & Polishing");
    expect(decodeHtmlEntities("Warranty &amp; Support")).toBe("Warranty & Support");
    expect(decodeHtmlEntities("&lt;tag&gt;")).toBe("<tag>");
    expect(decodeHtmlEntities("&quot;quoted&quot;")).toBe('"quoted"');
    expect(decodeHtmlEntities("it&#039;s")).toBe("it's");
  });

  it("decodes numeric and hex entities", () => {
    expect(decodeHtmlEntities("&#38;")).toBe("&");
    expect(decodeHtmlEntities("&#x26;")).toBe("&");
  });

  it("leaves plain text untouched", () => {
    expect(decodeHtmlEntities("Cordless Power Tools")).toBe("Cordless Power Tools");
  });

  it("leaves unrecognized entity-like sequences untouched rather than corrupting them", () => {
    expect(decodeHtmlEntities("50% off &notarealentity; here")).toBe("50% off &notarealentity; here");
  });
});
