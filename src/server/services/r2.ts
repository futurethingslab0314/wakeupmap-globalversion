import { createHash, createHmac } from "node:crypto";
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

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function hashSha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmacSha256(key: string | Uint8Array, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function encodeR2Key(key: string): string {
  return key.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function signR2Request(options: {
  method: string;
  url: URL;
  accessKeyId: string;
  secretAccessKey: string;
  body: Uint8Array;
  contentType: string;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hashSha256(options.body);
  const host = options.url.host;
  const canonicalUri = options.url.pathname;
  const canonicalHeaders =
    `content-type:${options.contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    options.method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashSha256(canonicalRequest),
  ].join("\n");
  const kDate = hmacSha256(`AWS4${options.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, "auto");
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${options.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    authorization,
    amzDate,
    payloadHash,
  };
}

export function createR2Client(options: CreateR2ClientOptions): R2Client {
  return {
    async upload(request: R2UploadRequest): Promise<R2UploadResult> {
      const url = new URL(`${options.endpoint.replace(/\/$/, "")}/${options.bucket}/${encodeR2Key(request.key)}`);
      const signature = signR2Request({
        method: "PUT",
        url,
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
        body: request.body,
        contentType: request.contentType,
      });

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: signature.authorization,
          "Content-Type": request.contentType,
          "x-amz-content-sha256": signature.payloadHash,
          "x-amz-date": signature.amzDate,
        },
        body: Buffer.from(request.body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`R2 upload failed with status ${response.status}: ${errorText}`);
      }

      return {
        key: request.key,
        url: buildR2PublicUrl(options.publicUrlBase, request.key),
      };
    },
  };
}
