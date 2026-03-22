import type { BreakfastConcept, CityMappingRecord, OpenAIClient } from "../types.ts";

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
  });

  return JSON.parse(response) as BreakfastConcept;
}
