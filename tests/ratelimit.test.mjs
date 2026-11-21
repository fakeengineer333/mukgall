import { describe, it } from "node:test";
import assert from "node:assert/strict";

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { checkRateLimit } = await import("../src/lib/ratelimit.ts");

describe("checkRateLimit (in-memory fallback)", () => {
  it("allows requests within limit and blocks once exceeded", async () => {
    const key = `test-limit-${Math.random()}`;
    const r1 = await checkRateLimit(key, 2, 60);
    const r2 = await checkRateLimit(key, 2, 60);
    const r3 = await checkRateLimit(key, 2, 60);

    assert.equal(r1.success, true);
    assert.equal(r1.remaining, 1);
    assert.equal(r2.success, true);
    assert.equal(r2.remaining, 0);
    assert.equal(r3.success, false);
    assert.equal(r3.remaining, 0);
  });

  it("isolates counters across distinct keys", async () => {
    const keyA = `test-iso-a-${Math.random()}`;
    const keyB = `test-iso-b-${Math.random()}`;

    await checkRateLimit(keyA, 1, 60);
    const blockedA = await checkRateLimit(keyA, 1, 60);
    const allowedB = await checkRateLimit(keyB, 1, 60);

    assert.equal(blockedA.success, false);
    assert.equal(allowedB.success, true);
  });

  it("resets limit after window expires", async () => {
    const key = `test-reset-${Math.random()}`;
    const realDateNow = Date.now;
    let fakeNow = 1_700_000_000_000;
    Date.now = () => fakeNow;

    try {
      const r1 = await checkRateLimit(key, 1, 10);
      const r2 = await checkRateLimit(key, 1, 10);
      assert.equal(r1.success, true);
      assert.equal(r2.success, false);

      fakeNow += 11_000;
      const r3 = await checkRateLimit(key, 1, 10);
      assert.equal(r3.success, true);
      assert.equal(r3.remaining, 0);
    } finally {
      Date.now = realDateNow;
    }
  });
});
