import type { OpenAIClient, OpenAIImageResult, RecipeResult } from "../types.ts";

interface GenerateBreakfastImageInput {
  openai: Pick<OpenAIClient, "generateImage">;
  cityName: string;
  countryName: string;
  recipe: RecipeResult;
}

function buildPrompt(input: GenerateBreakfastImageInput): string {
  if (input.recipe.imagePrompt?.trim()) {
    return [
      input.recipe.imagePrompt.trim(),
      `Inspired by authentic ${input.cityName}, ${input.countryName} food culture.`,
      ...(input.recipe.sceneSetting ? [`Scene setting: ${input.recipe.sceneSetting}.`] : []),
      ...(input.recipe.visualAnchors?.length
        ? [`Visual anchors: ${input.recipe.visualAnchors.join(", ")}.`]
        : []),
      ...(input.recipe.breakfastCategory ? [`Breakfast category: ${input.recipe.breakfastCategory}.`] : []),
      "Fixed camera angle: top view.",
      "Single-person breakfast portion.",
      "Show only food, utensils, and tabletop.",
      "Natural light, realistic textures, editorial composition.",
      "Avoid generic brunch styling, luxury hotel plating, and unrelated western props.",
      "No people, no humans, no hands, no text, no logo, no watermark.",
    ].join(" ");
  }

  return [
    `Top view editorial food photograph of a single-person breakfast set inspired by authentic ${input.cityName}, ${input.countryName} food culture.`,
    `Dish title: ${input.recipe.title}.`,
    `Must include these ingredients from recipe: ${input.recipe.highlightIngredients.join(", ")}.`,
    `Match recipe plating style and portions: ${input.recipe.recipe}`,
    ...(input.recipe.sceneSetting ? [`Scene setting: ${input.recipe.sceneSetting}.`] : []),
    ...(input.recipe.visualAnchors?.length
      ? [`Visual anchors: ${input.recipe.visualAnchors.join(", ")}.`]
      : []),
    ...(input.recipe.breakfastCategory ? [`Breakfast category: ${input.recipe.breakfastCategory}.`] : []),
    "Show only food, utensils, and tabletop.",
    "Top view, single-person composition, natural light, realistic textures, editorial composition.",
    "Avoid generic brunch styling, luxury hotel plating, and unrelated western props.",
    "No people, no humans, no hands, no text, no logo, no watermark.",
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
