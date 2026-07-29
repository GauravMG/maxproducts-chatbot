import { describe, expect, it } from "vitest";
import { issueToken, verifyToken } from "./token.js";

const SECRET = "test-shared-secret-please-change";

describe("issueToken / verifyToken", () => {
  it("round-trips a payload", () => {
    const token = issueToken({ uid: 101, email: "a@example.com" }, SECRET, 60);
    const result = verifyToken<{ uid: number; email: string }>(token, SECRET);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.uid).toBe(101);
      expect(result.payload.email).toBe("a@example.com");
      expect(result.payload.exp).toBeGreaterThan(result.payload.iat);
    }
  });

  it("rejects a token signed with a different secret", () => {
    const token = issueToken({ uid: 1 }, SECRET, 60);
    const result = verifyToken(token, "a-completely-different-secret");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("bad_signature");
  });

  it("rejects a tampered payload", () => {
    const token = issueToken({ uid: 1 }, SECRET, 60);
    const [segment, signature] = token.split(".");
    const tampered = `${segment}x.${signature}`;
    const result = verifyToken(tampered, SECRET);
    expect(result.ok).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = issueToken({ uid: 1 }, SECRET, -10);
    const result = verifyToken(token, SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("rejects a malformed token", () => {
    const result = verifyToken("not-a-real-token", SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("malformed");
  });
});
