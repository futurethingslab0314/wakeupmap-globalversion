import type { CityMappingRecord, OpenAIClient, StoryResult } from "../types";

interface GenerateStoryInput {
  openai: Pick<OpenAIClient, "generateText">;
  city: CityMappingRecord;
  greeting: string;
  userName?: string;
}

export async function generateStory(input: GenerateStoryInput): Promise<StoryResult> {
  const response = await input.openai.generateText({
    systemPrompt: "Create a short bilingual morning scene as JSON.",
    userPrompt: [
      `Selected city: ${input.city.city}, ${input.city.country}`,
      `Greeting to weave in: ${input.greeting}`,
      `User name: ${input.userName ?? "Traveler"}`,
      'The first sentence must begin with "You wake up in".',
      "Return JSON with keys story and storyZh.",
    ].join("\n"),
  });

  return JSON.parse(response) as StoryResult;
}
