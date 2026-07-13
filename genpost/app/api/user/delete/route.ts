import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

// DELETE /api/user/delete — Delete user account
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete user from Neon DB (cascade deletes their posts as configured in schema)
    await query("DELETE FROM public.users WHERE id = $1", [userId]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/user/delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
