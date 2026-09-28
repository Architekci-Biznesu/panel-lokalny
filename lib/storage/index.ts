import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import {
  assertPublicImage,
  buildImageKey,
  keyFromPublicUrl,
  publicUrlForKey,
  type PublicImageType,
} from "@/lib/storage/image-rules";

/**
 * Public image storage (Cloudflare R2 over the S3 API). The rest of the app
 * calls only putPublicImage / deletePublicImage - never the SDK directly.
 */

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Magazyn grafik nie jest skonfigurowany (brak zmiennych R2)");
    this.name = "StorageNotConfiguredError";
  }
}

function readConfig(): R2Config {
  const config = {
    accountId: process.env.R2_ACCOUNT_ID?.trim() ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim() ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "",
    bucket: process.env.R2_BUCKET?.trim() ?? "",
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.trim() ?? "",
  };
  if (Object.values(config).some((value) => !value)) {
    throw new StorageNotConfiguredError();
  }
  return config;
}

let client: S3Client | null = null;

function getClient(config: R2Config): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return client;
}

/** Re-encodes the image (drops metadata and anything smuggled after the pixels). */
async function reencode(
  bytes: Uint8Array,
  type: PublicImageType,
): Promise<Buffer> {
  const image = sharp(bytes, { failOn: "error" });
  return type === "image/png"
    ? image.png().toBuffer()
    : image.jpeg({ quality: 88 }).toBuffer();
}

export async function putPublicImage(
  bytes: Uint8Array,
  mimeType: string,
  options: { profileId: string },
): Promise<{ url: string; key: string }> {
  const type = assertPublicImage(bytes, mimeType);
  const config = readConfig();
  const body = await reencode(bytes, type);
  const key = buildImageKey(options.profileId, type);

  await getClient(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: type,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return { url: publicUrlForKey(config.publicBaseUrl, key), key };
}

/** Storage key of an image we host, from its public URL (null for foreign URLs). */
export function publicImageKeyFromUrl(url: string): string | null {
  return keyFromPublicUrl(process.env.R2_PUBLIC_BASE_URL?.trim() ?? "", url);
}

export async function deletePublicImage(key: string): Promise<void> {
  if (!key.startsWith("content/")) return;
  const config = readConfig();
  await getClient(config).send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
  );
}
