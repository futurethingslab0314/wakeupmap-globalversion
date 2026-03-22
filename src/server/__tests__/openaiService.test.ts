import test from "node:test";
import assert from "node:assert/strict";

import { createOpenAIClient } from "../services/openai";

test("generateText falls back to message content text when output_text is empty", async () => {
  const originalFetch = globalThis.fetch;

  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        output_text: "",
        output: [
          {
            content: [
              {
                type: "output_text",
                text: '{"story":"Hello","storyZh":"哈囉"}',
              },
            ],
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  globalThis.fetch = mockFetch;

  try {
    const client = createOpenAIClient({ apiKey: "test-key" });
    const result = await client.generateText({
      systemPrompt: "Return JSON.",
      userPrompt: "Test",
      responseFormat: {
        type: "json_schema",
        name: "wake_up_story",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            story: { type: "string" },
            storyZh: { type: "string" },
          },
          required: ["story", "storyZh"],
        },
        strict: true,
      },
    });

    assert.equal(result, '{"story":"Hello","storyZh":"哈囉"}');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("generateText surfaces model refusal when no text content is returned", async () => {
  const originalFetch = globalThis.fetch;

  const mockFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        output_text: "",
        output: [
          {
            content: [
              {
                type: "refusal",
                refusal: "I can't comply with that request.",
              },
            ],
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  globalThis.fetch = mockFetch;

  try {
    const client = createOpenAIClient({ apiKey: "test-key" });

    await assert.rejects(
      () =>
        client.generateText({
          systemPrompt: "Return JSON.",
          userPrompt: "Test",
        }),
      /refused: I can't comply with that request\./i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
