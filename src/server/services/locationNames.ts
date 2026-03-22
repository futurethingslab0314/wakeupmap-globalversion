import { parseModelJson } from "./parseModelJson.ts";
import type { OpenAIClient } from "../types.ts";

const locationZhNamesSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cityZh: { type: "string" },
    countryZh: { type: "string" },
  },
  required: ["cityZh", "countryZh"],
} as const;

interface LocalizeLocationNamesInput {
  openai: Pick<OpenAIClient, "generateText">;
  city: string;
  cityZh: string;
  country: string;
  countryZh: string;
}

export async function localizeLocationNames(input: LocalizeLocationNamesInput): Promise<{
  cityZh: string;
  countryZh: string;
}> {
  const needsCityTranslation = input.cityZh.trim() === input.city.trim();
  const needsCountryTranslation = input.countryZh.trim() === input.country.trim();

  if (!needsCityTranslation && !needsCountryTranslation) {
    return {
      cityZh: input.cityZh,
      countryZh: input.countryZh,
    };
  }

  const response = await input.openai.generateText({
    systemPrompt: "Translate place names into Traditional Chinese and return JSON.",
    userPrompt: [
      `City in English: ${input.city}`,
      `Country in English: ${input.country}`,
      "Return Traditional Chinese names that are natural and commonly used in Taiwan.",
      "Return JSON with keys cityZh and countryZh.",
    ].join("\n"),
    responseFormat: {
      type: "json_schema",
      name: "location_zh_names",
      schema: locationZhNamesSchema,
      strict: true,
    },
  });

  return parseModelJson<{ cityZh: string; countryZh: string }>(response, "Location name generator");
}
