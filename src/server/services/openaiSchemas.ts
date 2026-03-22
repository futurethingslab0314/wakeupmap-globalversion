export const wakeUpStorySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    story: { type: "string" },
    storyZh: { type: "string" },
  },
  required: ["story", "storyZh"],
} as const;

export const localBreakfastSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    nameZh: { type: "string" },
    description: { type: "string" },
    descriptionZh: { type: "string" },
    highlightIngredients: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["name", "nameZh", "description", "descriptionZh", "highlightIngredients"],
} as const;

export const breakfastRecipeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    titleZh: { type: "string" },
    recipe: { type: "string" },
    recipeZh: { type: "string" },
    highlightIngredients: {
      type: "array",
      items: { type: "string" },
    },
    imagePrompt: { type: "string" },
  },
  required: ["title", "titleZh", "recipe", "recipeZh", "highlightIngredients", "imagePrompt"],
} as const;
