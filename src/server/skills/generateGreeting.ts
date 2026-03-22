import type { CityMappingRecord, OpenAIClient } from "../types.ts";

interface GenerateGreetingInput {
  openai: Pick<OpenAIClient, "generateText">;
  city: CityMappingRecord;
}

export async function generateGreeting(input: GenerateGreetingInput): Promise<string> {
  return input.openai.generateText({
    systemPrompt: "You determine the everyday local language and produce one short natural morning greeting.",
    userPrompt: [
      `City: ${input.city.city}, ${input.city.country}`,
      `Local language code hint: ${input.city.languageCode}`,
      `Greeting style hint: ${input.city.greetingHint}`,
      "Determine the most widely used local language for an everyday greeting in this city.",
      "Return one short natural morning greeting in that language.",
      "Limit the greeting to 3 to 20 characters including spaces.",
      "Return only the greeting text with no explanation.",
    ].join("\n"),
  });
}
