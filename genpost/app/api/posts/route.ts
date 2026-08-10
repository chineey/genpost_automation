import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { UTApi } from "uploadthing/server";

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

    // 3. Fetch all media linked to these posts
    let mediaRows: any[] = [];
    if (posts.length > 0) {
      const postIds = posts.map(p => p.id);
      mediaRows = await query(
        `SELECT pm.post_id, m.id, m.url, m.file_key, m.type, m.size_bytes, pm.position
         FROM public.post_media pm
         JOIN public.media m ON pm.media_id = m.id
         WHERE pm.post_id = ANY($1)
         ORDER BY pm.position ASC`,
        [postIds]
      );
    }

    // Group media by post_id
    const mediaByPostId: Record<string, any[]> = {};
    for (const row of mediaRows) {
      if (!mediaByPostId[row.post_id]) {
        mediaByPostId[row.post_id] = [];
      }
      mediaByPostId[row.post_id].push({
        id: row.id,
        url: row.url,
        fileKey: row.file_key,
        type: row.type,
        sizeBytes: row.size_bytes,
        position: row.position
      });
    }

    // Attach media to posts
    const postsWithMedia = posts.map(post => ({
      ...post,
      media: mediaByPostId[post.id] ?? []
    }));

    return NextResponse.json({ profile, posts: postsWithMedia });
  } catch (err: unknown) {
    console.error("GET /api/posts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/posts — Update post status, content, media attachments, or scheduled time
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, content, scheduled_time, status, media_ids } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Missing post ID" }, { status: 400 });
    }

    // Ensure the post belongs to the logged-in user
    const posts = await query("SELECT id, content, status FROM public.posts WHERE id = $1 AND user_id = $2", [id, userId]);
    if (posts.length === 0) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    const existingPost = posts[0];
    if (existingPost.status === "posted") {
      return NextResponse.json({ error: "Cannot edit a published post" }, { status: 400 });
    }

    // Build the dynamic update query for the 'posts' table
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      params.push(content);
      
      const containsLink = content.includes("http");
      updates.push(`contains_link = $${paramIndex++}`);
      params.push(containsLink);
    }

    if (scheduled_time !== undefined) {
      updates.push(`scheduled_time = $${paramIndex++}`);
      params.push(scheduled_time ? new Date(scheduled_time).toISOString() : null);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    if (updates.length > 0) {
      params.push(id);
      await query(
        `UPDATE public.posts SET ${updates.join(", ")}, updated_at = now() WHERE id = $${paramIndex}`,
        params
      );
    }

    // Handle media updates if 'media_ids' is provided
    if (media_ids !== undefined && Array.isArray(media_ids)) {
      // Find the media IDs currently associated with the post
      const currentMediaRows = await query(
        "SELECT media_id FROM public.post_media WHERE post_id = $1",
        [id]
      );
      const currentMediaIds = currentMediaRows.map(r => r.media_id);
      
      // Find media IDs that are being removed
      const removedMediaIds = currentMediaIds.filter(mid => !media_ids.includes(mid));
      
      if (removedMediaIds.length > 0) {
        // Fetch file keys for these removed media to delete from UploadThing
        const mediaToDelete = await query(
          "SELECT id, file_key FROM public.media WHERE id = ANY($1)",
          [removedMediaIds]
        );
        
        const fileKeysToDelete = mediaToDelete.map(m => m.file_key).filter(Boolean);
        if (fileKeysToDelete.length > 0) {
          try {
            const utapi = new UTApi();
            await utapi.deleteFiles(fileKeysToDelete);
          } catch (utErr) {
            console.error("Failed to delete orphaned files from UploadThing:", utErr);
          }
        }
        
        // Delete these media records from database
        await query("DELETE FROM public.media WHERE id = ANY($1)", [removedMediaIds]);
      }

      // 1. Delete all existing post_media links for this post
      await query("DELETE FROM public.post_media WHERE post_id = $1", [id]);
      
      // 2. Insert new post_media links with their position order
      for (let i = 0; i < media_ids.length; i++) {
        const mediaId = media_ids[i];
        await query(
          "INSERT INTO public.post_media (post_id, media_id, position) VALUES ($1, $2, $3)",
          [id, mediaId, i]
        );
      }
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

    // Ensure the post belongs to the logged-in user
    const posts = await query("SELECT id FROM public.posts WHERE id = $1 AND user_id = $2", [id, userId]);
    if (posts.length === 0) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    // 1. Find all media associated with this post
    const mediaRows = await query(
      `SELECT m.id, m.file_key FROM public.media m
       JOIN public.post_media pm ON pm.media_id = m.id
       WHERE pm.post_id = $1`,
      [id]
    );

    const mediaIds = mediaRows.map(r => r.id);
    const fileKeys = mediaRows.map(r => r.file_key).filter(Boolean);

    // 2. Delete files from UploadThing
    if (fileKeys.length > 0) {
      try {
        const utapi = new UTApi();
        await utapi.deleteFiles(fileKeys);
      } catch (utErr) {
        console.error("Failed to delete files from UploadThing during post deletion:", utErr);
      }
    }

    // 3. Delete media records from database (cascade deletes will clean up post_media)
    if (mediaIds.length > 0) {
      await query("DELETE FROM public.media WHERE id = ANY($1)", [mediaIds]);
    }

    // 4. Delete post (cascade will handle anything remaining)
    await query(
      "DELETE FROM public.posts WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/posts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
