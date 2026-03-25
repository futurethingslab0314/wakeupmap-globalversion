import type {
  BreakfastConcept,
  CityMappingRecord,
  OpenAIClient,
  PersonalizationSummary,
  StoryResult,
} from "../types.ts";
import { parseModelJson } from "../services/parseModelJson.ts";
import { localBreakfastSchema } from "../services/openaiSchemas.ts";

interface GenerateLocalBreakfastInput {
  openai: Pick<OpenAIClient, "generateText">;
  city: CityMappingRecord;
  story?: StoryResult;
  personalization?: PersonalizationSummary;
}

export async function generateLocalBreakfast(
  input: GenerateLocalBreakfastInput,
): Promise<BreakfastConcept> {
  const response = await input.openai.generateText({
    systemPrompt: "Recommend one iconic local breakfast and return it as JSON.",
    userPrompt: [
      `City: ${input.city.city}, ${input.city.country}`,
      `Language code: ${input.city.languageCode}`,
      ...(input.story
        ? [
            `Story tone: ${input.story.tone}`,
            `Story motifs: ${input.story.motifs.join(", ")}`,
          ]
        : []),
      ...(input.personalization
        ? [
            `Recent patterns to consider: ${input.personalization.recentPatterns.join("; ") || "None"}`,
            `Stable preferences to preserve lightly: ${input.personalization.stablePreferences.join("; ") || "None"}`,
            ...input.personalization.avoidRepeats,
          ]
        : []),
      "Choose one breakfast that feels like the same morning as the story.",
      "Prioritize city-level breakfast culture, serving context, and plausible tableware or packaging.",
      "Use short label-style values for breakfastCategory and sceneSetting, ideally 1 to 4 words.",
      "Do not use commas in breakfastCategory, sceneSetting, motifs, or visualAnchors.",
      "Return JSON with name, nameZh, description, descriptionZh, highlightIngredients, breakfastCategory, sceneSetting, visualAnchors, avoidRepeats.",
      "highlightIngredients must be an array of short canonical ingredient names.",
      "visualAnchors must be an array of concrete city-grounded serving or tableware cues.",
      "avoidRepeats must be an array of brief repetition-control notes.",
    ].join("\n"),
    responseFormat: {
      type: "json_schema",
      name: "local_breakfast",
      schema: localBreakfastSchema,
      strict: true,
    },
  });

  return parseModelJson<BreakfastConcept>(response, "Breakfast generator");
}
