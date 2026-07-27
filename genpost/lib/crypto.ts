import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ─── Encryption ──────────────────────────────────────────────────────────────
// Secrets (X OAuth tokens, Amnesia API keys, ...) are encrypted with
// AES-256-GCM before being written to Neon. The encryption key must be
// exactly 32 bytes (256 bits), stored as a hex string.

function getEncryptionKey(): Buffer {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("TOKEN_ENCRYPTION_KEY environment variable is not defined");
  }
  return Buffer.from(keyHex, "hex");
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12); // GCM standard: 96-bit IV
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv(24) + authTag(32) + ciphertext — all base64
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decrypt(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
