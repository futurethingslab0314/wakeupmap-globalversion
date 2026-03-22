import type { BreakfastConcept, CityMappingRecord, OpenAIClient } from "../types.ts";
import { parseModelJson } from "../services/parseModelJson.ts";
import { localBreakfastSchema } from "../services/openaiSchemas.ts";

interface GenerateLocalBreakfastInput {
  openai: Pick<OpenAIClient, "generateText">;
  city: CityMappingRecord;
}

export async function generateLocalBreakfast(
  input: GenerateLocalBreakfastInput,
): Promise<BreakfastConcept> {
  const response = await input.openai.generateText({
    systemPrompt: "Recommend one iconic local breakfast and return it as JSON.",
    userPrompt: [
      `City: ${input.city.city}, ${input.city.country}`,
      `Language code: ${input.city.languageCode}`,
      "Return JSON with name, nameZh, description, descriptionZh, highlightIngredients.",
      "highlightIngredients must be an array of short canonical ingredient names.",
    ].join("\n"),
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "local_breakfast",
        schema: localBreakfastSchema,
        strict: true,
      },
    },
  });

  return parseModelJson<BreakfastConcept>(response, "Breakfast generator");
}
