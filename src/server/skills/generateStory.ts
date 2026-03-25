import type {
  CityMappingRecord,
  OpenAIClient,
  PersonalizationSummary,
  StoryResult,
} from "../types.ts";
import { parseModelJson } from "../services/parseModelJson.ts";
import { wakeUpStorySchema } from "../services/openaiSchemas.ts";

interface GenerateStoryInput {
  openai: Pick<OpenAIClient, "generateText">;
  city: CityMappingRecord;
  greeting: string;
  userName?: string;
  personalization?: PersonalizationSummary;
}

export async function generateStory(input: GenerateStoryInput): Promise<StoryResult> {
  const response = await input.openai.generateText({
    systemPrompt: "Create a grounded bilingual wake-up vignette as JSON.",
    userPrompt: [
      `Selected city: ${input.city.city}, ${input.city.country}`,
      `Greeting to weave in: ${input.greeting}`,
      `User name: ${input.userName ?? "Traveler"}`,
      ...(input.personalization
        ? [
            `Recent patterns to consider: ${input.personalization.recentPatterns.join("; ") || "None"}`,
            `Stable preferences to preserve lightly: ${input.personalization.stablePreferences.join("; ") || "None"}`,
            ...input.personalization.avoidRepeats.map((item) => `Avoid repeating ${item}`),
            `Confidence notes: ${input.personalization.confidenceNotes}`,
          ]
        : []),
      `The English story must begin exactly with: "Today you wake up in ${input.city.city}, ${input.city.country}."`,
      `The Traditional Chinese story must begin exactly with: "今天的你甦醒在${input.city.countryZh}的${input.city.cityZh}。"`,
      "Include local cultural habits, geography, and one lesser-known historical detail.",
      "Keep the English story under 150 words.",
      "Keep the Traditional Chinese story under 150 Chinese characters.",
      "Avoid stereotypes and invented facts.",
      "Also return a short tone label and 2 to 4 motifs that describe the morning.",
      "Return JSON with keys story, storyZh, tone, motifs.",
    ].join("\n"),
    responseFormat: {
      type: "json_schema",
      name: "wake_up_story",
      schema: wakeUpStorySchema,
      strict: true,
    },
  });

  return parseModelJson<StoryResult>(response, "Story generator");
}
