import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

// GET /api/posts — Retrieve user's posts & user quota profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch user profile stats
    const users = await query(
      "SELECT plan, monthly_post_quota, posts_used_this_cycle, x_username FROM public.users WHERE id = $1",
      [userId]
    );
    const profile = users[0] ?? { plan: "free", monthly_post_quota: 10, posts_used_this_cycle: 0, x_username: null };

    // 2. Fetch user's posts
    const posts = await query(
      "SELECT * FROM public.posts WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    return NextResponse.json({ profile, posts });
  } catch (err: unknown) {
    console.error("GET /api/posts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/posts — Update post status or scheduled time
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, status, scheduled_time } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Missing post ID" }, { status: 400 });
    }

    // Ensure the post belongs to the logged-in user
    const posts = await query("SELECT id FROM public.posts WHERE id = $1 AND user_id = $2", [id, userId]);
    if (posts.length === 0) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    if (status !== undefined && scheduled_time !== undefined) {
      await query(
        "UPDATE public.posts SET status = $1, scheduled_time = $2 WHERE id = $3",
        [status, scheduled_time, id]
      );
    } else if (status !== undefined) {
      await query(
        "UPDATE public.posts SET status = $1 WHERE id = $2",
        [status, id]
      );
    } else if (scheduled_time !== undefined) {
      await query(
        "UPDATE public.posts SET scheduled_time = $1 WHERE id = $2",
        [scheduled_time, id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("PATCH /api/posts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/posts — Delete a post
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing post ID" }, { status: 400 });
    }

    // Delete post ensuring user ownership
    const res = await query(
      "DELETE FROM public.posts WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    );

    if (res.length === 0) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/posts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
