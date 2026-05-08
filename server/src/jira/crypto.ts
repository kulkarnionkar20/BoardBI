import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../env.js";

const ALG = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const k = Buffer.from(env.encryptionKeyB64, "base64");
  if (k.length !== 32) {
    throw new Error(
      `APP_ENCRYPTION_KEY must decode to 32 bytes (got ${k.length}). ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    );
  }
  cachedKey = k;
  return k;
}

// Format: base64(iv) "." base64(tag) "." base64(ciphertext)
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Malformed ciphertext");
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) throw new Error("Malformed ciphertext");
  const decipher = createDecipheriv(ALG, key(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
