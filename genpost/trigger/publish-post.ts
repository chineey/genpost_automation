import { task } from "@trigger.dev/sdk/v3";
import { getValidXToken } from "../lib/x-oauth";
import { query } from "../lib/db";

// ─── Helper: check if user has quota ──────────────────────────────────────
async function hasQuota(userId: string): Promise<boolean> {
  const users = await query(
    "SELECT posts_used_this_cycle, monthly_post_quota FROM public.users WHERE id = $1",
    [userId]
  );
  const user = users[0];
  if (!user) return false;
  return user.posts_used_this_cycle < user.monthly_post_quota;
}

// ─── Helper: increment posts_used_this_cycle ───────────────────────────────
async function incrementUsage(userId: string) {
  const users = await query(
    "SELECT posts_used_this_cycle FROM public.users WHERE id = $1",
    [userId]
  );
  const user = users[0];
  const nextCount = (user?.posts_used_this_cycle ?? 0) + 1;

  await query(
    "UPDATE public.users SET posts_used_this_cycle = $1 WHERE id = $2",
    [nextCount, userId]
  );
}

// ─── Helper: Upload media URL to X via oauth 2.0 user token ────────────────
async function uploadMediaToX(accessToken: string, mediaUrl: string): Promise<string> {
  console.log(`[PublishPostTask] Fetching media from: ${mediaUrl}`);
  
  // 1. Fetch file from UploadThing URL
  const fileRes = await fetch(mediaUrl);
  if (!fileRes.ok) {
    throw new Error(`Failed to fetch media from URL ${mediaUrl}: ${fileRes.statusText}`);
  }
  const fileBuffer = await fileRes.arrayBuffer();

  // 2. Prepare form data
  const formData = new FormData();
  const blob = new Blob([fileBuffer]);
  formData.append("media", blob);

  // 3. Upload to X media v1.1 upload API
  console.log("[PublishPostTask] Uploading to X media API...");
  const uploadRes = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`X Media Upload failed: ${errorText}`);
  }

  const result = await uploadRes.json();
  const mediaId = result.media_id_string;
  if (!mediaId) {
    throw new Error("X Media Upload did not return a media_id_string");
  }
  
  console.log(`[PublishPostTask] Uploaded media successfully. X ID: ${mediaId}`);
  return mediaId;
}

// ─── Main publishing task ───────────────────────────────────────────────────
export const publishPost = task({
  id: "publish-post",
  run: async (payload: { postId: string }) => {
    console.log(`[PublishPostTask] Started for post ID: ${payload.postId}`);

    // 1. Fetch the latest post state from DB
    const posts = await query("SELECT * FROM public.posts WHERE id = $1", [payload.postId]);
    const post = posts[0];
    
    if (!post) {
      console.error(`[PublishPostTask] Post ${payload.postId} not found in database.`);
      return { success: false, error: "Post not found" };
    }

    // 2. Status guardrail: Only publish if still "approved"
    if (post.status !== "approved") {
      console.log(`[PublishPostTask] Post ${post.id} is in status "${post.status}" (not "approved"). Skipping.`);
      return { success: false, reason: `Status is ${post.status}` };
    }

    try {
      // 3. Quota check
      const quota = await hasQuota(post.user_id);
      if (!quota) {
        await query(
          `UPDATE public.posts 
           SET status = $1, error_message = $2 
           WHERE id = $3`,
          ["failed", "Monthly post quota exceeded. Upgrade your plan to continue posting.", post.id]
        );
        console.warn(`[PublishPostTask] Post ${post.id}: quota exceeded for user ${post.user_id}`);
        return { success: false, reason: "Quota exceeded" };
      }

      // 4. Fetch associated media URLs from DB
      const mediaList = await query(
        `SELECT m.url FROM public.media m
         INNER JOIN public.post_media pm ON pm.media_id = m.id
         WHERE pm.post_id = $1
         ORDER BY pm.position ASC`,
        [post.id]
      );

      // 5. Get valid (auto-refreshed) X access token
      const accessToken = await getValidXToken(post.user_id);

      // 6. Upload media files to X if any exist
      const mediaIds: string[] = [];
      for (const m of mediaList) {
        const xMediaId = await uploadMediaToX(accessToken, m.url);
        mediaIds.push(xMediaId);
      }

      // 7. Post to X API
      const tweetBody: any = { text: post.content };
      if (mediaIds.length > 0) {
        tweetBody.media = { media_ids: mediaIds };
      }

      console.log(`[PublishPostTask] Posting tweet to X...`);
      const xResponse = await fetch("https://api.x.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tweetBody),
      });

      if (!xResponse.ok) {
        const errorBody = await xResponse.text();
        throw new Error(`X API ${xResponse.status}: ${errorBody}`);
      }

      const result = await xResponse.json();
      const tweetId = result?.data?.id;

      // 8. Mark as posted
      await query(
        `UPDATE public.posts 
         SET status = $1, x_post_id = $2, error_message = null 
         WHERE id = $3`,
        ["posted", tweetId ?? null, post.id]
      );

      // 9. Increment usage counter
      await incrementUsage(post.user_id);

      console.log(`[PublishPostTask] ✅ Published post ${post.id} → X tweet ${tweetId}`);
      return { success: true, tweetId };

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[PublishPostTask] ❌ Failed post ${post.id}:`, message);

      await query(
        `UPDATE public.posts 
         SET status = $1, error_message = $2 
         WHERE id = $3`,
        ["failed", message.slice(0, 500), post.id]
      );

      return { success: false, error: message };
    }
  },
});
