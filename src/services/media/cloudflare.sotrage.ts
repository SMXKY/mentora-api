import fs from "fs";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { StorageAdapter, assertSafeRelativePath } from "./storage.adapter";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrlBase: string;
}

function loadConfig(): R2Config {
  const required = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_URL_BASE",
  ];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Invalid R2 storage configuration: missing ${key}`);
    }
  }
  return {
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: process.env.R2_BUCKET!,
    // e.g. "https://media.yourapp.com" (custom domain) or the r2.dev
    // public bucket URL. Never store this — resolved fresh each call,
    // same pattern as the FTP adapter.
    publicUrlBase: process.env.R2_PUBLIC_URL_BASE!,
  };
}

function buildKey(relativePath: string): string {
  assertSafeRelativePath(relativePath);
  return relativePath.replace(/\\/g, "/");
}

// Lazy singleton, mirrors how the FTP adapter's config is loaded once
// and reused — avoids re-reading env / re-instantiating the SDK client
// on every request.
let clientSingleton: S3Client | null = null;
let configSingleton: R2Config | null = null;

function getClient(): { client: S3Client; config: R2Config } {
  if (!clientSingleton || !configSingleton) {
    configSingleton = loadConfig();
    clientSingleton = new S3Client({
      region: "auto",
      endpoint: `https://${configSingleton.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: configSingleton.accessKeyId,
        secretAccessKey: configSingleton.secretAccessKey,
      },
    });
  }
  return { client: clientSingleton, config: configSingleton };
}

export class CloudflareR2StorageAdapter implements StorageAdapter {
  async put(tempFilePath: string, relativePath: string): Promise<void> {
    const key = buildKey(relativePath);
    const { client, config } = getClient();
    const stats = fs.statSync(tempFilePath);

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: fs.createReadStream(tempFilePath),
        ContentLength: stats.size,
      })
    );
  }

  async remove(relativePath: string): Promise<void> {
    const key = buildKey(relativePath);
    const { client, config } = getClient();
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key })
      );
    } catch (err: any) {
      // Same policy as the other adapters: deletion failures never
      // block app flow but must be visible.
      console.error({
        event: "r2_storage_remove_failed",
        key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  resolveUrl(relativePath: string): string {
    const key = buildKey(relativePath);
    const { config } = getClient();
    return `${config.publicUrlBase.replace(/\/+$/, "")}/${key}`;
  }

  async fetchToTemp(relativePath: string, destTempPath: string): Promise<void> {
    const key = buildKey(relativePath);
    const { client, config } = getClient();
    fs.mkdirSync(path.dirname(destTempPath), { recursive: true });

    const response = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key })
    );
    const body = response.Body as NodeJS.ReadableStream;

    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(destTempPath);
      body.on("error", reject);
      writeStream.on("error", reject);
      writeStream.on("close", resolve);
      body.pipe(writeStream);
    });
  }
}
