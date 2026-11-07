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

  const result = await verifyAmnesiaApiKey(apiKey.trim());
  if (!result.ok) {
    if (result.reason === "unreachable") {
      return NextResponse.json(
        { error: "Could not reach Amnesia server (it may be waking up from sleep). Please try clicking Connect again in a few seconds." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "That API key isn't valid. Generate a fresh key in Amnesia (Connect GenPost → Generate new key) and paste it here." },
      { status: 400 }
    );
  }

  await saveAmnesiaApiKey(userId, apiKey.trim());

  return NextResponse.json({ success: true, email: result.user.email });
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
