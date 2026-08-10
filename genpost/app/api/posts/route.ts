import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { tasks, runs } from "@trigger.dev/sdk/v3";

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

    // 3. Fetch all media for this user's posts to minimize query count
    const postMediaList = await query(
      `SELECT pm.post_id, m.id, m.url, m.file_key, m.type, m.size_bytes
       FROM public.post_media pm
       INNER JOIN public.media m ON m.id = pm.media_id
       INNER JOIN public.posts p ON p.id = pm.post_id
       WHERE p.user_id = $1
       ORDER BY pm.position ASC`,
      [userId]
    );

    // 4. Map media to posts
    const postsWithMedia = posts.map((post: any) => ({
      ...post,
      media: postMediaList
        .filter((pm: any) => pm.post_id === post.id)
        .map((pm: any) => ({
          id: pm.id,
          url: pm.url,
          file_key: pm.file_key,
          type: pm.type,
          size_bytes: pm.size_bytes,
        })),
    }));

    return NextResponse.json({ profile, posts: postsWithMedia });
  } catch (err: unknown) {
    console.error("GET /api/posts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/posts — Update post status, scheduled time, content, or media associations
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, status, scheduled_time, content, media_ids } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Missing post ID" }, { status: 400 });
    }

    // Ensure the post belongs to the logged-in user
    const posts = await query(
      "SELECT id, status, scheduled_time, trigger_job_id FROM public.posts WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    const post = posts[0];
    if (!post) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    // 1. Guardrail: Block edits after publishing
    if (post.status === "posted") {
      return NextResponse.json({ error: "Cannot edit already published posts" }, { status: 400 });
    }

    // 2. Build the main post fields updates dynamically
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      params.push(content);

      // Link-post cost detection check
      const containsLink = content.includes("http");
      updates.push(`contains_link = $${paramIndex++}`);
      params.push(containsLink);
    }

    // 3. Handle scheduling / unscheduling Trigger.dev tasks
    let newJobId: string | null = null;

    if (status !== undefined || scheduled_time !== undefined) {
      const targetStatus = status !== undefined ? status : post.status;
      const targetTime = scheduled_time !== undefined ? scheduled_time : post.scheduled_time;

      if (targetStatus === "approved") {
        if (!targetTime) {
          return NextResponse.json({ error: "Cannot schedule post: scheduled time is required" }, { status: 400 });
        }

        const timeChanged = targetTime !== post.scheduled_time;
        const noJob = !post.trigger_job_id;

        // Schedule new job if time changed, or no job exists
        if (timeChanged || noJob) {
          // Cancel existing job if present
          if (post.trigger_job_id) {
            try {
              await runs.cancel(post.trigger_job_id);
            } catch (err: any) {
              console.warn(`[API] Failed to cancel task ${post.trigger_job_id}:`, err.message);
            }
          }

          // Calculate delay
          let delayDate = new Date(targetTime);
          // If scheduled in the past, execute immediately (with a tiny 2s delay to allow DB write)
          if (delayDate.getTime() <= Date.now()) {
            delayDate = new Date(Date.now() + 2000);
          }

          console.log(`[API] Scheduling Trigger.dev job for post ${id} at ${delayDate.toISOString()}`);
          const handle = await tasks.trigger(
            "publish-post",
            { postId: id },
            { delay: delayDate }
          );
          
          newJobId = handle.id;
          updates.push(`trigger_job_id = $${paramIndex++}`);
          params.push(newJobId);
          updates.push(`scheduled_time = $${paramIndex++}`);
          params.push(delayDate.toISOString());
          
          // Force status to approved when scheduled
          updates.push(`status = $${paramIndex++}`);
          params.push("approved");
        } else if (status !== undefined) {
          updates.push(`status = $${paramIndex++}`);
          params.push(status);
        }
      } else if (targetStatus === "draft") {
        // Unschedule: Cancel existing job
        if (post.trigger_job_id) {
          try {
            await runs.cancel(post.trigger_job_id);
          } catch (err: any) {
            console.warn(`[API] Failed to cancel task ${post.trigger_job_id}:`, err.message);
          }
        }
        updates.push(`trigger_job_id = NULL`);
        updates.push(`scheduled_time = NULL`);
        updates.push(`status = $${paramIndex++}`);
        params.push("draft");
      } else {
        if (status !== undefined) {
          updates.push(`status = $${paramIndex++}`);
          params.push(status);
        }
        if (scheduled_time !== undefined) {
          updates.push(`scheduled_time = $${paramIndex++}`);
          params.push(scheduled_time);
        }
      }
    }

    if (updates.length > 0) {
      params.push(id);
      const queryText = `UPDATE public.posts SET ${updates.join(", ")} WHERE id = $${paramIndex}`;
      await query(queryText, params);
    }

    // 4. Update post media attachments if media_ids array is provided
    if (media_ids !== undefined) {
      // Clear existing associations
      await query("DELETE FROM public.post_media WHERE post_id = $1", [id]);

      // Re-insert with positions
      for (let i = 0; i < media_ids.length; i++) {
        await query(
          "INSERT INTO public.post_media (post_id, media_id, position) VALUES ($1, $2, $3)",
          [id, media_ids[i], i]
        );
      }
    }

    return NextResponse.json({ success: true, triggerJobId: newJobId });
  } catch (err: unknown) {
    console.error("PATCH /api/posts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/posts — Delete a post and cancel any associated active Trigger.dev tasks
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

    // Retrieve post to cancel the Trigger.dev job before deletion
    const posts = await query(
      "SELECT trigger_job_id FROM public.posts WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    const post = posts[0];

    if (!post) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    if (post.trigger_job_id) {
      try {
        console.log(`[API] Canceling job ${post.trigger_job_id} before post deletion...`);
        await runs.cancel(post.trigger_job_id);
      } catch (err: any) {
        console.error("[API] Trigger.dev task cancellation failed:", err.message);
      }
    }

    // Delete post ensuring user ownership
    await query("DELETE FROM public.posts WHERE id = $1", [id]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/posts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

