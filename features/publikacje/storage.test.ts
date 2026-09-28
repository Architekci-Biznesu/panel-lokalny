import assert from "node:assert/strict";
import {
  PUBLIC_IMAGE_MAX_BYTES,
  assertPublicImage,
  buildImageKey,
  detectImageType,
  keyFromPublicUrl,
  publicUrlForKey,
} from "../../lib/storage/image-rules";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);
const PROFILE = "3f2b8c1e-5d4a-4b7e-9c1d-2a6f8e0b4c11";

/** Type is read from the file signature, not trusted from the caller. */
{
  assert.equal(detectImageType(PNG), "image/png");
  assert.equal(detectImageType(JPG), "image/jpeg");
  assert.equal(detectImageType(new Uint8Array([0x47, 0x49, 0x46])), null);

  assert.equal(assertPublicImage(PNG, "image/png"), "image/png");
  assert.throws(() => assertPublicImage(PNG, "image/jpeg"), /nie zgadza/);
  assert.throws(() => assertPublicImage(PNG, "image/gif"), /PNG i JPEG/);
  assert.throws(
    () => assertPublicImage(new Uint8Array(), "image/png"),
    /Pusta/,
  );
  const tooBig = new Uint8Array(PUBLIC_IMAGE_MAX_BYTES + 1);
  tooBig.set(PNG);
  assert.throws(() => assertPublicImage(tooBig, "image/png"), /za duża/);
}

/** Keys are server-generated and prefixed by profile; URL = base + key. */
{
  const key = buildImageKey(PROFILE, "image/png", "abc");
  assert.equal(key, `content/${PROFILE}/abc.png`);
  assert.match(
    buildImageKey(PROFILE, "image/jpeg"),
    /^content\/.+\/[0-9a-f-]{36}\.jpg$/,
  );
  assert.throws(() => buildImageKey("../../etc", "image/png"), /profilu/);

  const base = "https://pub-123.r2.dev/";
  const url = publicUrlForKey(base, key);
  assert.equal(url, `https://pub-123.r2.dev/${key}`);
  assert.equal(keyFromPublicUrl(base, url), key);
  assert.equal(keyFromPublicUrl(base, "https://other.example/x.png"), null);
  assert.equal(keyFromPublicUrl("", url), null);
}

console.log("content storage tests passed");
