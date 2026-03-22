import type { OpenAIImageResult, R2Client } from "../types";

interface UploadImageToR2Input {
  r2: Pick<R2Client, "upload">;
  imageBinary: Uint8Array;
  cityName: string;
  recordedAtIso: string;
}

interface UploadImageToR2Result {
  imageUrl: string;
  imageStorageKey: string;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildStorageKey(cityName: string, recordedAtIso: string): string {
  const citySlug = slugify(cityName);
  const timestampSlug = recordedAtIso.toLowerCase().replace(/[:.]/g, "-");
  return `wake-up-now/${citySlug}/${timestampSlug}.png`;
}

export async function uploadImageToR2(input: UploadImageToR2Input): Promise<UploadImageToR2Result> {
  if (input.imageBinary.length === 0) {
    throw new Error("imageBinary must not be empty");
  }

  const imageStorageKey = buildStorageKey(input.cityName, input.recordedAtIso);
  const uploadResult = await input.r2.upload({
    key: imageStorageKey,
    body: input.imageBinary,
    contentType: "image/png",
  });

  return {
    imageUrl: uploadResult.url,
    imageStorageKey: uploadResult.key,
  };
}
