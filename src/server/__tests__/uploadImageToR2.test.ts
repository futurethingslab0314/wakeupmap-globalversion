import test from "node:test";
import assert from "node:assert/strict";

import { uploadImageToR2 } from "../skills/uploadImageToR2";
import type { R2UploadRequest } from "../types";

test("uploadImageToR2 builds deterministic storage keys and returns url plus key", async () => {
  const requests: R2UploadRequest[] = [];
  const r2 = {
    upload: async (request: R2UploadRequest) => {
      requests.push(request);
      return {
        key: request.key,
        url: `https://cdn.example.com/${request.key}`,
      };
    },
  };

  const result = await uploadImageToR2({
    r2,
    imageBinary: new Uint8Array([1, 2, 3]),
    cityName: "Mexico City",
    recordedAtIso: "2026-03-22T08:00:00.000Z",
  });

  assert.equal(result.imageStorageKey, "wake-up-now/mexico-city/2026-03-22t08-00-00-000z.png");
  assert.equal(result.imageUrl, "https://cdn.example.com/wake-up-now/mexico-city/2026-03-22t08-00-00-000z.png");
  assert.equal(requests[0].contentType, "image/png");
});

test("uploadImageToR2 refuses empty imageBinary", async () => {
  await assert.rejects(
    () =>
      uploadImageToR2({
        r2: {
          upload: async () => ({ key: "unused", url: "https://example.com/unused" }),
        },
        imageBinary: new Uint8Array([]),
        cityName: "Taipei",
        recordedAtIso: "2026-03-22T08:00:00.000Z",
      }),
    /imageBinary must not be empty/,
  );
});
