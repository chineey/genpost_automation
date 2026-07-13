import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

// DELETE /api/auth/x — Disconnect user's connected X account
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Clear user's X tokens and username inside Neon
    await query(
      `UPDATE public.users 
       SET x_username = null, x_oauth_token = null, x_refresh_token = null, token_expires_at = null 
       WHERE id = $1`,
      [userId]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/auth/x error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
