import type { OpenAIClient, OpenAIImageRequest, OpenAITextRequest } from "../types.ts";

interface CreateOpenAIClientOptions {
  apiKey: string;
  textModel?: string;
  imageModel?: string;
}

export function createOpenAIClient(options: CreateOpenAIClientOptions): OpenAIClient {
  const textModel = options.textModel ?? "gpt-4.1-mini";
  const imageModel = options.imageModel ?? "gpt-image-1";

  return {
    async generateText(request: OpenAITextRequest): Promise<string> {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: textModel,
          input: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
          ...(request.responseFormat
            ? {
                text: {
                  format: request.responseFormat,
                },
              }
            : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI text request failed with status ${response.status}`);
      }

      const data = (await response.json()) as {
        output_text?: string;
      };

      return data.output_text ?? "";
    },
    async generateImage(request: OpenAIImageRequest): Promise<Uint8Array> {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: imageModel,
          prompt: request.prompt,
          size: "1024x1024",
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI image request failed with status ${response.status}`);
      }

      const data = (await response.json()) as {
        data?: Array<{ b64_json?: string }>;
      };
      const base64 = data.data?.[0]?.b64_json;

      if (!base64) {
        throw new Error("OpenAI image response did not include image data");
      }

      return Uint8Array.from(Buffer.from(base64, "base64"));
    },
  };
}
