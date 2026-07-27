import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { getAmnesiaApiKey, ingestPost, removeAmnesiaApiKey, saveAmnesiaApiKey, verifyAmnesiaApiKey } from "@/lib/amnesia";

// Cap on how many existing posts get backfilled into Amnesia when connecting,
// so a long-time user doesn't trigger dozens of embedding calls at once.
const BACKFILL_LIMIT = 30;

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

  // Best-effort: backfill the user's existing posted/approved content so
  // Amnesia has something to draw on immediately instead of starting cold.
  const existingPosts = await query<{ content: string }>(
    `SELECT content FROM public.posts WHERE user_id = $1 AND status IN ('approved', 'posted')
     ORDER BY created_at DESC LIMIT $2`,
    [userId, BACKFILL_LIMIT]
  );
  await Promise.all(existingPosts.map((p) => ingestPost(apiKey.trim(), p.content)));

  return NextResponse.json({ success: true, email: amnesiaUser.email, backfilled: existingPosts.length });
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
