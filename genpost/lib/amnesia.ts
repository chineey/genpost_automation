import { query } from "./db";
import { encrypt, decrypt } from "./crypto";

// ─── Config ───────────────────────────────────────────────────────────────────
const AMNESIA_API_URL = (
  process.env.AMNESIA_API_URL || "https://amnesia-io.onrender.com"
).replace(/\/+$/, "");

// Amnesia's free-tier host (Render + Neon) can take 20-35s+ to cold-start after
// inactivity, so requests get a generous timeout and a retry for cold starts.
const VERIFY_TIMEOUT_MS = 35_000;
const CONTEXT_TIMEOUT_MS = 35_000;
const INGEST_TIMEOUT_MS = 35_000;
const RETRY_DELAY_MS = 2_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ProfileItem {
  content: string;
  confidence?: number;
  category?: string;
}

export interface CoreProfileData {
  facts: ProfileItem[];
  preferences: ProfileItem[];
  events: ProfileItem[];
}

export interface WritingContext {
  core_profile: CoreProfileData;
  voice_traits?: string[];
  topic_facts?: string[];
  episodic_snippets: string[];
}

// ─── Connection storage (per GenPost user) ───────────────────────────────────
export async function saveAmnesiaApiKey(userId: string, apiKey: string) {
  const encryptedKey = encrypt(apiKey);
  try {
    await query("UPDATE public.users SET amnesia_api_key = $1 WHERE id = $2", [encryptedKey, userId]);
  } catch (err: any) {
    if (String(err?.message || "").includes("amnesia_api_key")) {
      await query("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS amnesia_api_key text");
      await query("UPDATE public.users SET amnesia_api_key = $1 WHERE id = $2", [encryptedKey, userId]);
    } else {
      throw err;
    }
  }
}

export async function removeAmnesiaApiKey(userId: string) {
  await query("UPDATE public.users SET amnesia_api_key = NULL WHERE id = $1", [userId]);
}

export async function getAmnesiaApiKey(userId: string): Promise<string | null> {
  try {
    const rows = await query("SELECT amnesia_api_key FROM public.users WHERE id = $1", [userId]);
    const encrypted = rows[0]?.amnesia_api_key;
    if (!encrypted) return null;
    return decrypt(encrypted);
  } catch {
    return null;
  }
}

// ─── Verify a key before saving it (also doubles as a "who is this" check) ──
export type VerifyAmnesiaResult =
  | { ok: true; user: { id: string; email: string; api_key_prefix?: string } }
  | { ok: false; reason: "invalid_key" | "unreachable"; status?: number };

export async function verifyAmnesiaApiKey(apiKey: string): Promise<VerifyAmnesiaResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${AMNESIA_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        console.warn(`Amnesia API key rejected: HTTP ${res.status} from ${AMNESIA_API_URL}`);
        return { ok: false, reason: "invalid_key", status: res.status };
      }
      if (!res.ok) {
        console.warn(`Amnesia API key verification HTTP ${res.status} from ${AMNESIA_API_URL} (attempt ${attempt})`);
        if (attempt < 2) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        return { ok: false, reason: "unreachable", status: res.status };
      }
      const user = await res.json();
      return { ok: true, user };
    } catch (err) {
      console.error(`Error verifying Amnesia API key against ${AMNESIA_API_URL} (attempt ${attempt}):`, err);
      if (attempt < 2) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      return { ok: false, reason: "unreachable" };
    }
  }
  return { ok: false, reason: "unreachable" };
}

// ─── Fetch user's Core Profile from Amnesia ─────────────────────────────────
export async function getAmnesiaProfile(apiKey: string): Promise<CoreProfileData | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${AMNESIA_API_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(CONTEXT_TIMEOUT_MS),
      });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        console.warn(`Amnesia profile fetch rejected: HTTP ${res.status}`);
        return null;
      }
      if (!res.ok) {
        console.warn(`Amnesia profile fetch failed: HTTP ${res.status} (attempt ${attempt})`);
        if (attempt < 2) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        return null;
      }
      return await res.json();
    } catch (err) {
      if (attempt < 2) {
        console.warn(`Amnesia profile fetch timed out / errored (attempt ${attempt}), retrying...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      console.warn("Amnesia profile fetch errored:", err);
      return null;
    }
  }
  return null;
}

// ─── Retrieval: core profile + relevant past-post snippets for a topic ─────
export async function getWritingContext(apiKey: string, topicQuery: string): Promise<WritingContext | null> {
  const url = `${AMNESIA_API_URL}/api/context?${new URLSearchParams({ query: topicQuery, limit: "8" })}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(CONTEXT_TIMEOUT_MS),
      });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        console.warn(`Amnesia context fetch rejected: HTTP ${res.status}`);
        return null;
      }
      if (!res.ok) {
        console.warn(`Amnesia context fetch failed: HTTP ${res.status} (attempt ${attempt})`);
        if (attempt < 2) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        return null;
      }
      return await res.json();
    } catch (err) {
      if (attempt < 2) {
        console.warn(`Amnesia context fetch timed out / errored (attempt ${attempt}), retrying...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      console.warn("Amnesia context fetch errored, generating without memory context:", err);
      return null;
    }
  }
  return null;
}

// ─── Ingest: send a piece of text to Amnesia memory ──────────────────────────
// NOTE: Automatic post ingestion is disabled. Amnesia memory ingestion from GenPost
// is restricted to user-submitted Settings profile notes via pushProfileFacts.
export async function ingestPost(apiKey: string, content: string): Promise<void> {
  try {
    const res = await fetch(`${AMNESIA_API_URL}/api/memory/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`Amnesia memory ingest failed: HTTP ${res.status} from ${AMNESIA_API_URL}`);
    }
  } catch (err) {
    // Best-effort — never let a memory-ingestion hiccup fail the caller's request.
    console.warn("Amnesia memory ingest errored:", err);
  }
}

// ─── Onboarding: push declared voice/demographic facts into the Core Profile ─
export async function pushProfileFacts(
  apiKey: string,
  data: { facts?: ProfileItem[]; preferences?: ProfileItem[]; events?: ProfileItem[] }
): Promise<CoreProfileData | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${AMNESIA_API_URL}/api/profile/facts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
      });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        console.warn(`Amnesia profile facts push rejected: HTTP ${res.status} from ${AMNESIA_API_URL}`);
        return null;
      }
      if (!res.ok) {
        console.warn(`Amnesia profile facts push failed: HTTP ${res.status} from ${AMNESIA_API_URL} (attempt ${attempt})`);
        if (attempt < 2) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        return null;
      }
      const body = await res.json();
      return body.core_profile ?? { facts: [], preferences: [], events: [] };
    } catch (err) {
      if (attempt < 2) {
        console.warn(`Amnesia profile facts push timed out / errored (attempt ${attempt}), retrying...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      console.warn("Amnesia profile facts push errored:", err);
      return null;
    }
  }
  return null;
}

// ─── Formats a WritingContext into a prompt block for lib/gemini.ts ─────────
export function formatMemoryPromptBlock(context: WritingContext): string {
  const parts: string[] = [];

  const voiceTraits =
    context.voice_traits ??
    (context.core_profile?.preferences ?? []).map((p) => p.content);
  const topicFacts =
    context.topic_facts ??
    [...(context.core_profile?.facts ?? []), ...(context.core_profile?.events ?? [])].map((f) => f.content);

  if (voiceTraits.length > 0) {
    parts.push(
      `Writing style, tone & persona (use ONLY to shape voice/slang/cadence — do NOT force unrelated personal details into the post):\n${voiceTraits
        .map((t) => `- ${t}`)
        .join("\n")}`
    );
  }

  if (topicFacts.length > 0) {
    parts.push(
      `Topic-relevant background & opinions for this subject:\n${topicFacts
        .map((t) => `- ${t}`)
        .join("\n")}`
    );
  }

  if (context.episodic_snippets?.length > 0) {
    parts.push(
      `Topic-relevant past writing/snippets (match this voice, vocabulary, and rhythm):\n${context.episodic_snippets
        .map((s) => `- ${s}`)
        .join("\n")}`
    );
  }

  return parts.join("\n\n");
}
