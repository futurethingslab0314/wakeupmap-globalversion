import test from "node:test";
import assert from "node:assert/strict";

import { createR2Client } from "../services/r2";

test("createR2Client signs uploads with SigV4 headers required by R2", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  const mockFetch: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(null, { status: 200 });
  };

  globalThis.fetch = mockFetch;

  try {
    const r2 = createR2Client({
      endpoint: "https://example-account.r2.cloudflarestorage.com",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucket: "wakeupmap",
      publicUrlBase: "https://cdn.example.com",
    });

    const result = await r2.upload({
      key: "wake-up-now/taipei/demo.png",
      body: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
    });

    assert.equal(requestUrl, "https://example-account.r2.cloudflarestorage.com/wakeupmap/wake-up-now/taipei/demo.png");
    assert.equal(requestInit?.method, "PUT");
    assert.equal(result.url, "https://cdn.example.com/wake-up-now/taipei/demo.png");

    const headers = new Headers(requestInit?.headers);
    assert.equal(headers.get("Content-Type"), "image/png");
    assert.ok(headers.get("x-amz-date"));
    assert.ok(headers.get("x-amz-content-sha256"));
    assert.match(headers.get("Authorization") ?? "", /^AWS4-HMAC-SHA256 /);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
