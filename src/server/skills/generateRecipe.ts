import type { BreakfastConcept, OpenAIClient, RecipeResult } from "../types";

interface GenerateRecipeInput {
  openai: Pick<OpenAIClient, "generateText">;
  breakfastConcept: BreakfastConcept;
}

export async function generateRecipe(input: GenerateRecipeInput): Promise<RecipeResult> {
  const response = await input.openai.generateText({
    systemPrompt: "Turn the breakfast concept into a short UI-ready recipe JSON object.",
    userPrompt: [
      `Breakfast concept: ${input.breakfastConcept.name}`,
      `Description: ${input.breakfastConcept.description}`,
      `Highlight ingredients: ${input.breakfastConcept.highlightIngredients.join(", ")}`,
      "Return JSON with title, recipe, highlightIngredients.",
    ].join("\n"),
  });

  return JSON.parse(response) as RecipeResult;
}
