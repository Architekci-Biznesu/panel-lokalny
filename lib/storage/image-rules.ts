/**
 * Pure rules for public images (no SDK, no I/O) - shared by lib/storage and tests.
 */

export const PUBLIC_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export type PublicImageType = "image/png" | "image/jpeg";

export const PUBLIC_IMAGE_TYPES: readonly PublicImageType[] = [
  "image/png",
  "image/jpeg",
];

const EXTENSION: Record<PublicImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

export function isAllowedImageType(value: string): value is PublicImageType {
  return (PUBLIC_IMAGE_TYPES as readonly string[]).includes(value);
}

/** Type from the file signature - the declared mimeType is never trusted alone. */
export function detectImageType(bytes: Uint8Array): PublicImageType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  return null;
}

/** Throws a user-facing error when the bytes are not an allowed image. */
export function assertPublicImage(
  bytes: Uint8Array,
  mimeType: string,
): PublicImageType {
  if (!isAllowedImageType(mimeType)) {
    throw new Error("Dozwolone są tylko grafiki PNG i JPEG");
  }
  if (bytes.length === 0) {
    throw new Error("Pusta grafika");
  }
  if (bytes.length > PUBLIC_IMAGE_MAX_BYTES) {
    throw new Error("Grafika jest za duża (maks. 8 MB)");
  }
  const detected = detectImageType(bytes);
  if (detected !== mimeType) {
    throw new Error("Zawartość pliku nie zgadza się z typem grafiki");
  }
  return detected;
}

/** Server-generated key, prefixed by profile for cleanup and diagnostics. */
export function buildImageKey(
  profileId: string,
  type: PublicImageType,
  id: string = crypto.randomUUID(),
): string {
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) {
    throw new Error("Niepoprawny identyfikator profilu");
  }
  return `content/${profileId}/${id}.${EXTENSION[type]}`;
}

/** Public URL is always `${R2_PUBLIC_BASE_URL}/${key}` - no domain in code. */
export function publicUrlForKey(baseUrl: string, key: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${key}`;
}

/** Inverse of publicUrlForKey; null when the URL is not from our bucket. */
export function keyFromPublicUrl(baseUrl: string, url: string): string | null {
  const prefix = `${baseUrl.replace(/\/+$/, "")}/`;
  if (!baseUrl || !url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key.startsWith("content/") ? key : null;
}
