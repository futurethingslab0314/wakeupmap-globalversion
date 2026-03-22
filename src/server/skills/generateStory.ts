import type { CityMappingRecord, OpenAIClient, StoryResult } from "../types";

interface GenerateStoryInput {
  openai: Pick<OpenAIClient, "generateText">;
  city: CityMappingRecord;
  greeting: string;
  userName?: string;
}

export async function generateStory(input: GenerateStoryInput): Promise<StoryResult> {
  const response = await input.openai.generateText({
    systemPrompt: "Create a grounded bilingual wake-up vignette as JSON.",
    userPrompt: [
      `Selected city: ${input.city.city}, ${input.city.country}`,
      `Greeting to weave in: ${input.greeting}`,
      `User name: ${input.userName ?? "Traveler"}`,
      `The English story must begin exactly with: "Today you wake up in ${input.city.city}, ${input.city.country}."`,
      `The Traditional Chinese story must begin exactly with: "今天的你甦醒在${input.city.countryZh}的${input.city.cityZh}。"`,
      "Include local cultural habits, geography, and one lesser-known historical detail.",
      "Keep the English story under 150 words.",
      "Keep the Traditional Chinese story under 150 Chinese characters.",
      "Avoid stereotypes and invented facts.",
      "Return JSON with keys story and storyZh.",
    ].join("\n"),
  });

  return JSON.parse(response) as StoryResult;
}
