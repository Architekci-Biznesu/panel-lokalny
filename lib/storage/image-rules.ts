/**
 * Pure rules for public images (no SDK, no I/O) - shared by lib/storage and tests.
 */

export const PUBLIC_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Stored images fit in Google's recommended post size (1200 x 900, 4:3) -
 * never cropped, never enlarged. Keeps files well under Google's 5 MB limit.
 */
export const POST_IMAGE_MAX_WIDTH = 1200;
export const POST_IMAGE_MAX_HEIGHT = 900;

/** Formats stored and sent to Google (posts accept JPG and PNG). */
export type PublicImageType = "image/png" | "image/jpeg";

/** Formats accepted on upload - WEBP is converted to JPEG before storing. */
export type UploadImageType = PublicImageType | "image/webp";

export const UPLOAD_IMAGE_TYPES: readonly UploadImageType[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

const EXTENSION: Record<PublicImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

/** Browsers send "image/jpg" or no type at all - normalize before comparing. */
function declaredType(value: string): string {
  const type = value.trim().toLowerCase();
  return type === "image/jpg" || type === "image/pjpeg" ? "image/jpeg" : type;
}

/** Stored format for an accepted upload. */
export function storedImageType(type: UploadImageType): PublicImageType {
  return type === "image/webp" ? "image/jpeg" : type;
}

/** Type from the file signature - the declared mimeType is never trusted alone. */
export function detectImageType(bytes: Uint8Array): UploadImageType | null {
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
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/** Throws a user-facing error when the bytes are not an allowed image. */
export function assertPublicImage(
  bytes: Uint8Array,
  mimeType: string,
): UploadImageType {
  const declared = declaredType(mimeType);
  if (
    declared &&
    !(UPLOAD_IMAGE_TYPES as readonly string[]).includes(declared)
  ) {
    throw new Error("Dozwolone są zdjęcia JPG, PNG i WEBP");
  }
  if (bytes.length === 0) {
    throw new Error("Pusta grafika");
  }
  if (bytes.length > PUBLIC_IMAGE_MAX_BYTES) {
    throw new Error("Zdjęcie jest za duże (maks. 8 MB)");
  }
  const detected = detectImageType(bytes);
  if (!detected) {
    throw new Error("Dozwolone są zdjęcia JPG, PNG i WEBP");
  }
  if (declared && detected !== declared) {
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
