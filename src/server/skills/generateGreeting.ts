import type { CityMappingRecord, OpenAIClient } from "../types";

interface GenerateGreetingInput {
  openai: Pick<OpenAIClient, "generateText">;
  city: CityMappingRecord;
}

export async function generateGreeting(input: GenerateGreetingInput): Promise<string> {
  return input.openai.generateText({
    systemPrompt: "Write a concise local morning greeting for the selected city.",
    userPrompt: [
      `City: ${input.city.city}, ${input.city.country}`,
      `Local language code: ${input.city.languageCode}`,
      `Greeting style hint: ${input.city.greetingHint}`,
      "Return only the greeting text with no explanation.",
    ].join("\n"),
  });
}
