import type { R2Client, R2UploadRequest, R2UploadResult } from "../types.ts";

interface CreateR2ClientOptions {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrlBase: string;
}

export function buildR2PublicUrl(publicUrlBase: string, key: string): string {
  return `${publicUrlBase.replace(/\/$/, "")}/${key}`;
}

export function createR2Client(options: CreateR2ClientOptions): R2Client {
  return {
    async upload(request: R2UploadRequest): Promise<R2UploadResult> {
      const url = `${options.endpoint.replace(/\/$/, "")}/${options.bucket}/${request.key}`;
      const authToken = Buffer.from(`${options.accessKeyId}:${options.secretAccessKey}`).toString("base64");

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Basic ${authToken}`,
          "Content-Type": request.contentType,
        },
        body: Buffer.from(request.body),
      });

      if (!response.ok) {
        throw new Error(`R2 upload failed with status ${response.status}`);
      }

      return {
        key: request.key,
        url: buildR2PublicUrl(options.publicUrlBase, request.key),
      };
    },
  };
}
