import { query } from "./db";
import { encrypt, decrypt } from "./crypto";

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
  codeVerifier: string,
  redirectUri?: string
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
      redirect_uri: redirectUri || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`,
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
