import { query } from "./db";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ─── Encryption ──────────────────────────────────────────────────────────────
// Tokens are encrypted with AES-256-GCM before being written to Neon.
// The encryption key must be exactly 32 bytes (256 bits), stored as a hex string.

function getEncryptionKey(): Buffer {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("TOKEN_ENCRYPTION_KEY environment variable is not defined");
  }
  return Buffer.from(keyHex, "hex");
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(12); // GCM standard: 96-bit IV
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv(24) + authTag(32) + ciphertext — all base64
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

function decrypt(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ─── Token types ─────────────────────────────────────────────────────────────
interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

// ─── Store tokens ─────────────────────────────────────────────────────────────
export async function storeXTokens(userId: string, tokens: TokenPair) {
  try {
    await query(
      `UPDATE public.users 
       SET x_oauth_token = $1, x_refresh_token = $2, token_expires_at = $3 
       WHERE id = $4`,
      [
        encrypt(tokens.access_token),
        encrypt(tokens.refresh_token),
        tokens.expires_at.toISOString(),
        userId,
      ]
    );
  } catch (err: any) {
    throw new Error(`Failed to store X tokens: ${err.message}`);
  }
}

// ─── Get valid token (auto-refreshes if expired) ───────────────────────────
export async function getValidXToken(userId: string): Promise<string> {
  const profiles = await query(
    "SELECT x_oauth_token, x_refresh_token, token_expires_at, x_username FROM public.users WHERE id = $1",
    [userId]
  );
  const profile = profiles[0];

  if (!profile || !profile.x_oauth_token) {
    throw new Error("X account not connected for this user");
  }

  const expiresAt = new Date(profile.token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // refresh 5 minutes early

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    // Token is still valid
    return decrypt(profile.x_oauth_token);
  }

  // ── Token expired → refresh ──
  const refreshToken = decrypt(profile.x_refresh_token);
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`X token refresh failed: ${text}`);
  }

  const data = await response.json();
  const newExpiry = new Date(Date.now() + data.expires_in * 1000);

  await storeXTokens(userId, {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: newExpiry,
  });

  return data.access_token;
}

// ─── Build X OAuth authorize URL ─────────────────────────────────────────────
export function buildXAuthUrl(userId: string, codeVerifier: string): string {
  const codeChallenge = codeVerifier; // plain method for simplicity; use S256 in prod
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`,
    scope: "tweet.read tweet.write users.read offline.access",
    state: userId,
    code_challenge: codeChallenge,
    code_challenge_method: "plain",
  });
  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

// ─── Exchange code for tokens ─────────────────────────────────────────────────
export async function exchangeXCode(
  code: string,
  codeVerifier: string
): Promise<TokenPair> {
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`X token exchange failed: ${text}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000),
  };
}
