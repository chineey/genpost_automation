import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAmnesiaApiKey, pushProfileFacts } from "@/lib/amnesia";

// POST /api/amnesia/profile — push onboarding voice/demographic notes into
// the user's Amnesia Core Profile (facts the user declares about themselves,
// since GenPost users won't build this up by chatting with Amnesia directly).
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = await getAmnesiaApiKey(userId);
  if (!apiKey) {
    return NextResponse.json({ error: "Amnesia is not connected" }, { status: 400 });
  }

  const { about, voice } = await request.json();
  const facts = about?.trim() ? [{ content: about.trim() }] : [];
  const preferences = voice?.trim() ? [{ content: voice.trim() }] : [];

  if (facts.length === 0 && preferences.length === 0) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }

  const ok = await pushProfileFacts(apiKey, { facts, preferences });
  if (!ok) {
    return NextResponse.json({ error: "Failed to reach Amnesia. Try again in a moment." }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
