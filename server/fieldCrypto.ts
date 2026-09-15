/**
 * Field-level encryption for the columns that must not be readable in a dump.
 *
 * Lifted out of server/storage.ts so more than one store can use it without
 * importing the whole database layer (and without a second copy of the cipher
 * drifting from the first). storage.ts keeps using it for carrier credentials
 * and payment settings; server/journalStore.ts uses it for clinical bodies.
 *
 * AES-256-CBC with a random IV per value, stored as "<iv hex>:<ciphertext hex>".
 * The key is ENCRYPTION_KEY, a 64-character hex string.
 *
 * Callers that hold health data must gate on `isEncryptionConfigured()` and
 * refuse the request when it is false, rather than fall back to plaintext.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

function keyMaterial(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 64) return null;
  try {
    const key = Buffer.from(raw.slice(0, 64), "hex");
    // A 64-char string that is not valid hex silently yields a short buffer,
    // which createCipheriv would reject later with a far less obvious error.
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

/** True when ENCRYPTION_KEY is present and usable as a 32-byte key. */
export function isEncryptionConfigured(): boolean {
  return keyMaterial() !== null;
}

export function encrypt(text: string): string {
  const key = keyMaterial();
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not configured. Cannot store encrypted data.");
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  const key = keyMaterial();
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not configured. Cannot decrypt data.");
  }
  try {
    const [ivHex, encrypted] = encryptedText.split(":");
    if (!ivHex || !encrypted) {
      throw new Error("Invalid encrypted format");
    }
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data. The encryption key may have changed.");
  }
}
