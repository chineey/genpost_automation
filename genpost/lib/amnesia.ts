import { query } from "./db";
import { encrypt, decrypt } from "./crypto";

// ─── Config ───────────────────────────────────────────────────────────────────
const AMNESIA_API_URL = process.env.AMNESIA_API_URL || "https://amnesia-io.onrender.com";

// Amnesia's free-tier host can cold-start after inactivity, so retrieval gets
// a generous timeout — but it must never block post generation for long if
// Amnesia is unreachable.
const CONTEXT_TIMEOUT_MS = 12_000;
const INGEST_TIMEOUT_MS = 8_000;

export interface ProfileItem {
  content: string;
  confidence?: number;
}

export interface WritingContext {
  core_profile: {
    facts: ProfileItem[];
    preferences: ProfileItem[];
    events: ProfileItem[];
  };
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
    if (!res.ok) return null;
    return await res.json();
  } catch {
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
    await fetch(`${AMNESIA_API_URL}/api/memory/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
    });
  } catch (err) {
    // Best-effort — never let a memory-ingestion hiccup fail the caller's request.
    console.warn("Amnesia memory ingest failed:", err);
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
    return res.ok;
  } catch (err) {
    console.warn("Amnesia profile facts push failed:", err);
    return false;
  }
}

// ─── Formats a WritingContext into a prompt block for lib/gemini.ts ─────────
export function formatMemoryPromptBlock(context: WritingContext): string {
  const parts: string[] = [];

  const { facts, preferences, events } = context.core_profile ?? {};
  const traits = [...(facts ?? []), ...(preferences ?? []), ...(events ?? [])].map((f) => f.content);
  if (traits.length > 0) {
    parts.push(`Known traits about this specific person (match tone/voice/slang to these, don't just state them):\n${traits.map((t) => `- ${t}`).join("\n")}`);
  }

  if (context.episodic_snippets?.length > 0) {
    parts.push(`Snippets of this person's own past posts/writing (mimic this exact voice, vocabulary, and rhythm):\n${context.episodic_snippets.map((s) => `- ${s}`).join("\n")}`);
  }

  return parts.join("\n\n");
}
