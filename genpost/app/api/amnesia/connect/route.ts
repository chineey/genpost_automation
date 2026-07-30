import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getAmnesiaApiKey, removeAmnesiaApiKey, saveAmnesiaApiKey, verifyAmnesiaApiKey } from "@/lib/amnesia";

// GET /api/amnesia/connect — connection status for the Settings page
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = await getAmnesiaApiKey(userId);
  return NextResponse.json({ connected: !!apiKey });
}

// POST /api/amnesia/connect — save + verify a pasted Amnesia API key
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { apiKey } = await request.json();
  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "Missing API key" }, { status: 400 });
  }

  const amnesiaUser = await verifyAmnesiaApiKey(apiKey.trim());
  if (!amnesiaUser) {
    return NextResponse.json({ error: "That API key isn't valid. Copy it again from Amnesia." }, { status: 400 });
  }

  await saveAmnesiaApiKey(userId, apiKey.trim());

  return NextResponse.json({ success: true, email: amnesiaUser.email });
}

// DELETE /api/amnesia/connect — disconnect
export async function DELETE() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await removeAmnesiaApiKey(userId);
  return NextResponse.json({ success: true });
}
