import { findPropertyName } from "../services/notion";
import { generateBreakfastImage } from "../skills/generateBreakfastImage";
import { generateRecipe } from "../skills/generateRecipe";
import { uploadImageToR2 } from "../skills/uploadImageToR2";
import type { NotionClient, OpenAIClient, R2Client, WakeUpImageJob } from "../types";

interface RunWakeUpImageInput {
  request: WakeUpImageJob;
  databaseId: string;
  notion: NotionClient;
  openai: OpenAIClient;
  r2: R2Client;
}

export async function runWakeUpImage(input: RunWakeUpImageInput): Promise<{ ok: true; imageUrl: string }> {
  const request = input.request;
  if (!request.breakfastName || !request.breakfastNameZh || !request.breakfastDescription || !request.breakfastDescriptionZh) {
    throw new Error("wake-up image job is missing structured breakfast fields");
  }

  const recipe = await generateRecipe({
    openai: input.openai,
    breakfastConcept: {
      name: request.breakfastName,
      nameZh: request.breakfastNameZh,
      description: request.breakfastDescription,
      descriptionZh: request.breakfastDescriptionZh,
      highlightIngredients: request.highlightIngredients ?? [],
      breakfastCategory: request.breakfastCategory ?? "",
      sceneSetting: request.sceneSetting ?? "",
      visualAnchors: request.visualAnchors ?? [],
      avoidRepeats: request.avoidRepeats ?? [],
    },
    cityName: request.city,
    countryName: request.country,
    cityNameZh: request.cityZh ?? request.city,
    countryNameZh: request.countryZh ?? request.country,
  });

  const image = await generateBreakfastImage({
    openai: input.openai,
    cityName: request.city,
    countryName: request.country,
    recipe,
  });

  const uploaded = await uploadImageToR2({
    r2: input.r2,
    imageBinary: image.imageBinary,
    cityName: request.city,
    recordedAtIso: request.recordedAtIso,
  });

  const database = await input.notion.getDatabase(input.databaseId);
  const patchProperties: Record<string, unknown> = {};

  const recipeName = findPropertyName(database.properties, "rich_text", ["recipe"]);
  if (recipeName) {
    patchProperties[recipeName] = {
      rich_text: [{ text: { content: recipe.recipe } }],
    };
  }

  const recipeZhName = findPropertyName(database.properties, "rich_text", ["recipe zh", "recipezh", "recipe_zh"]);
  if (recipeZhName) {
    patchProperties[recipeZhName] = {
      rich_text: [{ text: { content: recipe.recipeZh ?? "" } }],
    };
  }

  const imagePromptName = findPropertyName(database.properties, "rich_text", ["image prompt"]);
  if (imagePromptName) {
    patchProperties[imagePromptName] = {
      rich_text: [{ text: { content: image.prompt } }],
    };
  }

  const imageUrlName = findPropertyName(database.properties, "url", ["image url", "imageurl", "image"]);
  if (imageUrlName) {
    patchProperties[imageUrlName] = { url: uploaded.imageUrl };
  }

  await input.notion.updatePage(request.pageId, {
    properties: patchProperties,
  });

  return {
    ok: true,
    imageUrl: uploaded.imageUrl,
  };
}
