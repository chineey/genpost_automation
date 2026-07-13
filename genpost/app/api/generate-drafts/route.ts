import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { generatePosts, PostType } from "@/lib/gemini";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's plan + remaining quota from Neon
    const users = await query(
      "SELECT plan, monthly_post_quota, posts_used_this_cycle FROM public.users WHERE id = $1",
      [userId]
    );
    const userProfile = users[0];

    if (!userProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      topics,
      postTypes,
      count,
      additionalContext,
    }: {
      topics: string[];
      postTypes: PostType[];
      count: number;
      additionalContext?: string;
    } = body;

    // Validate
    if (!topics?.length || !postTypes?.length || !count) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (count > 50) {
      return NextResponse.json({ error: "Maximum 50 posts per generation" }, { status: 400 });
    }

    // Check quota
    const used = userProfile.posts_used_this_cycle ?? 0;
    const quota = userProfile.monthly_post_quota ?? 10;
    if (used + count > quota) {
      return NextResponse.json(
        {
          error: "quota_exceeded",
          message: `You have ${quota - used} posts remaining this cycle. Upgrade your plan for more.`,
        },
        { status: 403 }
      );
    }

    // Generate
    const posts = await generatePosts({ topics, postTypes, count, additionalContext });

    // Save to Neon DB as drafts using a multi-row parameterized insert statement
    const insertedPosts = [];
    for (const p of posts) {
      const containsLink = p.content.includes("http");
      const metadata = JSON.stringify({ topic: p.topic, type: p.type, character_count: p.character_count });
      
      const rows = await query(
        `INSERT INTO public.posts (user_id, content, contains_link, status, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, p.content, containsLink, "draft", metadata]
      );
      if (rows[0]) insertedPosts.push(rows[0]);
    }

    return NextResponse.json({ posts: insertedPosts, generated: posts.length });
  } catch (err: unknown) {
    console.error("Generate drafts error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
