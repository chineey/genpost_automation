import { query } from "./db";
import { encrypt, decrypt } from "./crypto";

// ─── Config ───────────────────────────────────────────────────────────────────
const AMNESIA_API_URL = process.env.AMNESIA_API_URL || "https://amnesia-k7quez-3dde07-169-58-208-39.sslip.io";

// Amnesia's free-tier host can cold-start after inactivity, so retrieval gets
// a generous timeout — but it must never block post generation for long if
// Amnesia is unreachable.
const CONTEXT_TIMEOUT_MS = 12_000;
const INGEST_TIMEOUT_MS = 8_000;

export interface ProfileItem {
  content: string;
  confidence?: number;
  category?: string;
}

export interface WritingContext {
  core_profile: {
    facts: ProfileItem[];
    preferences: ProfileItem[];
    events: ProfileItem[];
  };
  voice_traits?: string[];
  topic_facts?: string[];
  episodic_snippets: string[];
}

// ─── Connection storage (per GenPost user) ───────────────────────────────────
export async function saveAmnesiaApiKey(userId: string, apiKey: string) {
  await query("UPDATE public.users SET amnesia_api_key = $1 WHERE id = $2", [encrypt(apiKey), userId]);
}

export async function removeAmnesiaApiKey(userId: string) {
  await query("UPDATE public.users SET amnesia_api_key = NULL WHERE id = $1", [userId]);
}

export async function getAmnesiaApiKey(userId: string): Promise<string | null> {
  const rows = await query("SELECT amnesia_api_key FROM public.users WHERE id = $1", [userId]);
  const encrypted = rows[0]?.amnesia_api_key;
  if (!encrypted) return null;
  try {
    return decrypt(encrypted);
  } catch {
    return null;
  }
}

// ─── Verify a key before saving it (also doubles as a "who is this" check) ──
export async function verifyAmnesiaApiKey(apiKey: string): Promise<{ id: string; email: string } | null> {
  try {
    const res = await fetch(`${AMNESIA_API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.warn(`Amnesia API key verification failed: HTTP ${res.status} from ${AMNESIA_API_URL}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Error verifying Amnesia API key against ${AMNESIA_API_URL}:`, err);
    return null;
  }
}

// ─── Retrieval: core profile + relevant past-post snippets for a topic ─────
export async function getWritingContext(apiKey: string, topicQuery: string): Promise<WritingContext | null> {
  try {
    const res = await fetch(
      `${AMNESIA_API_URL}/api/context?${new URLSearchParams({ query: topicQuery, limit: "8" })}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(CONTEXT_TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      console.warn(`Amnesia context fetch failed: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn("Amnesia context fetch errored, generating without memory context:", err);
    return null;
  }
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
): Promise<boolean> {
  try {
    const res = await fetch(`${AMNESIA_API_URL}/api/profile/facts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`Amnesia profile facts push failed: HTTP ${res.status} from ${AMNESIA_API_URL}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Amnesia profile facts push errored:", err);
    return false;
  }
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
