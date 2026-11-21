import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verifyTurnstileToken } from "../src/lib/turnstile.ts";

describe("verifyTurnstileToken", () => {
  it("allows bypass when both secret key and site key are unconfigured", async () => {
    const prevSecret = process.env.TURNSTILE_SECRET_KEY;
    const prevSite = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const prevEnv = process.env.NODE_ENV;

    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NODE_ENV = "development";

    try {
      assert.equal(await verifyTurnstileToken(null), true);
    } finally {
      if (prevSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
      else process.env.TURNSTILE_SECRET_KEY = prevSecret;
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = prevSite;
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
    }
  });

  it("fails closed in production when site key is configured without secret key", async () => {
    const prevSecret = process.env.TURNSTILE_SECRET_KEY;
    const prevSite = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const prevEnv = process.env.NODE_ENV;

    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key-set";
    process.env.NODE_ENV = "production";

    try {
      assert.equal(await verifyTurnstileToken("some-token"), false);
    } finally {
      if (prevSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
      else process.env.TURNSTILE_SECRET_KEY = prevSecret;
      if (prevSite === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = prevSite;
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
    }
  });

  it("rejects missing token and validates against siteverify when secret key is configured", async () => {
    const prevSecret = process.env.TURNSTILE_SECRET_KEY;
    const prevFetch = globalThis.fetch;

    process.env.TURNSTILE_SECRET_KEY = "test-secret";

    try {
      assert.equal(await verifyTurnstileToken(""), false);
      assert.equal(await verifyTurnstileToken(null), false);

      globalThis.fetch = async () =>
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      assert.equal(await verifyTurnstileToken("valid-token", "1.2.3.4"), true);

      globalThis.fetch = async () =>
        new Response(JSON.stringify({ success: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      assert.equal(await verifyTurnstileToken("invalid-token", "1.2.3.4"), false);
    } finally {
      globalThis.fetch = prevFetch;
      if (prevSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
      else process.env.TURNSTILE_SECRET_KEY = prevSecret;
    }
  });
});
