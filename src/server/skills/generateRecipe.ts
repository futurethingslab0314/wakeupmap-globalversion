import type { BreakfastConcept, OpenAIClient, RecipeResult } from "../types.ts";
import { parseModelJson } from "../services/parseModelJson.ts";
import { breakfastRecipeSchema } from "../services/openaiSchemas.ts";

interface GenerateRecipeInput {
  openai: Pick<OpenAIClient, "generateText">;
  breakfastConcept: BreakfastConcept;
  cityName: string;
  countryName: string;
  cityNameZh: string;
  countryNameZh: string;
}

export async function generateRecipe(input: GenerateRecipeInput): Promise<RecipeResult> {
  const response = await input.openai.generateText({
    systemPrompt: "Create a practical bilingual single-serving recipe as JSON.",
    userPrompt: [
      `City: ${input.cityName}, ${input.countryName}`,
      `City (Traditional Chinese): ${input.cityNameZh}, ${input.countryNameZh}`,
      `Breakfast concept: ${input.breakfastConcept.name}`,
      `Breakfast concept (Traditional Chinese): ${input.breakfastConcept.nameZh}`,
      `Description: ${input.breakfastConcept.description}`,
      `Description (Traditional Chinese): ${input.breakfastConcept.descriptionZh}`,
      `Highlight ingredients: ${input.breakfastConcept.highlightIngredients.join(", ")}`,
      "Generate a practical single-serving breakfast recipe inspired by this city and country.",
      "The recipe must include ingredients with quantities, steps, and total time.",
      "Return bilingual content that stays consistent with the same ingredients in English and Traditional Chinese.",
      "Also return an image prompt that matches exactly the same ingredients and plating style.",
      "Return JSON with title, titleZh, recipe, recipeZh, highlightIngredients, imagePrompt.",
    ].join("\n"),
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "breakfast_recipe",
        schema: breakfastRecipeSchema,
        strict: true,
      },
    },
  });

  return parseModelJson<RecipeResult>(response, "Recipe generator");
}
