import type { OpenAIClient, OpenAIImageResult, RecipeResult } from "../types";

interface GenerateBreakfastImageInput {
  openai: Pick<OpenAIClient, "generateImage">;
  cityName: string;
  recipe: RecipeResult;
}

function buildPrompt(input: GenerateBreakfastImageInput): string {
  return [
    `Top view editorial food photograph of a single-serving breakfast from ${input.cityName}.`,
    `Dish title: ${input.recipe.title}.`,
    `Include these ingredients clearly: ${input.recipe.highlightIngredients.join(", ")}.`,
    "single-serving composition, plated neatly, natural morning light.",
    "no people, no hands, no text, no logo, no watermark.",
  ].join(" ");
}

export async function generateBreakfastImage(
  input: GenerateBreakfastImageInput,
): Promise<OpenAIImageResult> {
  const prompt = buildPrompt(input);
  const imageBinary = await input.openai.generateImage({ prompt });

  return {
    prompt,
    imageBinary,
  };
}
