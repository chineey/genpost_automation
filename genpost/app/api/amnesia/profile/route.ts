import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAmnesiaApiKey, getAmnesiaProfile, pushProfileFacts } from "@/lib/amnesia";

// GET /api/amnesia/profile — fetch the user's current Amnesia Core Profile
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = await getAmnesiaApiKey(userId);
  if (!apiKey) {
    return NextResponse.json({ error: "Amnesia is not connected" }, { status: 400 });
  }

  const profile = await getAmnesiaProfile(apiKey);
  if (!profile) {
    return NextResponse.json({ error: "Failed to fetch Amnesia profile." }, { status: 502 });
  }

  return NextResponse.json({ profile });
}

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
  const facts = about?.trim() ? [{ content: about.trim(), category: "identity" }] : [];
  const preferences = voice?.trim() ? [{ content: voice.trim(), category: "voice" }] : [];

  if (facts.length === 0 && preferences.length === 0) {
    return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
  }

  const updatedProfile = await pushProfileFacts(apiKey, { facts, preferences });
  if (!updatedProfile) {
    return NextResponse.json({ error: "Failed to reach Amnesia. Try again in a moment." }, { status: 502 });
  }

  return NextResponse.json({ success: true, profile: updatedProfile });
}
