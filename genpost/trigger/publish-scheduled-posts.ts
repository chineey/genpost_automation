import { schedules } from "@trigger.dev/sdk/v3";
import { getValidXToken } from "../lib/x-oauth";
import { query } from "../lib/db";

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

// ─── Helper: upload media to X API v2 using chunked upload ────────────────
async function uploadMediaToX(url: string, type: string, sizeBytes: number, accessToken: string): Promise<string> {
  console.log(`[PublishTask] Downloading media from ${url} (${sizeBytes} bytes)...`);
  const mediaResponse = await fetch(url);
  if (!mediaResponse.ok) {
    throw new Error(`Failed to download media: ${mediaResponse.statusText}`);
  }
  const arrayBuffer = await mediaResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const detectedType = mediaResponse.headers.get("content-type")?.split(";")[0]?.trim();
  const mediaType = detectedType || (type === "video" ? "video/mp4" : "image/jpeg");
  const mediaCategory = type === "video" ? "tweet_video" : mediaType === "image/gif" ? "tweet_gif" : "tweet_image";

  console.log(`[PublishTask] Initializing X v2 chunked upload (type: ${mediaType}, category: ${mediaCategory})...`);

  // 1. INITIALIZE
  const initRes = await fetch("https://api.x.com/2/media/upload/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      total_bytes: buffer.length,
      media_type: mediaType,
      media_category: mediaCategory,
    }),
  });

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`X Media INIT failed (${initRes.status}): ${errText}`);
  }

  const initData = await initRes.json();
  const mediaIdStr: string | undefined = initData?.data?.id ?? initData?.media_id_string ?? initData?.id;
  if (!mediaIdStr) {
    throw new Error(`X Media INIT returned no media id: ${JSON.stringify(initData)}`);
  }
  console.log(`[PublishTask] INIT success, media_id: ${mediaIdStr}`);

  // 2. APPEND (split into 1MB chunks)
  const chunkSize = 1 * 1024 * 1024; // 1MB chunks
  let segmentIndex = 0;
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    const chunk = buffer.subarray(offset, Math.min(offset + chunkSize, buffer.length));
    const formData = new FormData();
    formData.append("segment_index", segmentIndex.toString());
    formData.append("media", new Blob([chunk], { type: mediaType }));

    const appendRes = await fetch(`https://api.x.com/2/media/upload/${mediaIdStr}/append`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      throw new Error(`X Media APPEND chunk ${segmentIndex} failed (${appendRes.status}): ${errText}`);
    }

    console.log(`[PublishTask] APPEND chunk ${segmentIndex} uploaded`);
    segmentIndex++;
  }

  // 3. FINALIZE
  const finalizeRes = await fetch(`https://api.x.com/2/media/upload/${mediaIdStr}/finalize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!finalizeRes.ok) {
    const errText = await finalizeRes.text();
    throw new Error(`X Media FINALIZE failed (${finalizeRes.status}): ${errText}`);
  }

  const finalizeData = await finalizeRes.json();
  console.log(`[PublishTask] FINALIZE success`);

  // 4. STATUS check (polls processing status if it has processing_info)
  let processingInfo = finalizeData?.data?.processing_info ?? finalizeData?.processing_info;
  if (processingInfo) {
    let state = processingInfo.state;
    let checkAfterSecs = processingInfo.check_after_secs || 5;

    while (state === "pending" || state === "in_progress") {
      console.log(`[PublishTask] Media processing state is '${state}', waiting ${checkAfterSecs}s...`);
      await new Promise((resolve) => setTimeout(resolve, checkAfterSecs * 1000));

      const statusParams = new URLSearchParams({
        command: "STATUS",
        media_id: mediaIdStr,
      });

      const statusRes = await fetch(`https://api.x.com/2/media/upload?${statusParams.toString()}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!statusRes.ok) {
        const errText = await statusRes.text();
        throw new Error(`X Media STATUS check failed (${statusRes.status}): ${errText}`);
      }

      const statusData = await statusRes.json();
      processingInfo = statusData?.data?.processing_info ?? statusData?.processing_info;
      state = processingInfo?.state;
      checkAfterSecs = processingInfo?.check_after_secs || 5;

      if (processingInfo?.error) {
        throw new Error(`X Media processing error: ${processingInfo.error.message}`);
      }
    }
    console.log(`[PublishTask] Media processing completed with state: ${state}`);
  }

  return mediaIdStr;
}

// ─── Main scheduled task ─────────────────────────────────────────────────────
export const publishScheduledPosts = schedules.task({
  id: "publish-scheduled-posts",
  // Every minute
  cron: "* * * * *",

  run: async (payload) => {
    console.log(`[PublishTask] Running at ${payload.timestamp?.toISOString() ?? new Date().toISOString()}`);

    let duePosts;
    try {
      // Fetch all approved posts whose scheduled_time has passed
      duePosts = await query(
        `SELECT * FROM public.posts 
         WHERE status = $1 AND scheduled_time <= $2 
         ORDER BY scheduled_time ASC 
         LIMIT 50`,
        ["approved", new Date().toISOString()]
      );
    } catch (err: any) {
      console.error("[PublishTask] Failed to fetch due posts:", err.message);
      return { published: 0, failed: 0, error: err.message };
    }

    if (!duePosts || duePosts.length === 0) {
      console.log("[PublishTask] No posts due.");
      return { published: 0, failed: 0 };
    }

    console.log(`[PublishTask] Found ${duePosts.length} post(s) to publish.`);

    let published = 0;
    let failed = 0;

    for (const post of duePosts) {
      try {
        // ── Quota check ──────────────────────────────────────────────────
        const quota = await hasQuota(post.user_id);
        if (!quota) {
          await query(
            `UPDATE public.posts 
             SET status = $1, error_message = $2 
             WHERE id = $3`,
            ["failed", "Monthly post quota exceeded. Upgrade your plan to continue posting.", post.id]
          );
          failed++;
          console.warn(`[PublishTask] Post ${post.id}: quota exceeded for user ${post.user_id}`);
          continue;
        }

        // ── Get valid (auto-refreshed) X access token ─────────────────
        const accessToken = await getValidXToken(post.user_id);

        // ── Fetch and upload media if any ─────────────────────────────
        const mediaRows = await query(
          `SELECT m.url, m.type, m.size_bytes FROM public.post_media pm
           JOIN public.media m ON pm.media_id = m.id
           WHERE pm.post_id = $1
           ORDER BY pm.position ASC`,
          [post.id]
        );

        const mediaIds: string[] = [];
        for (const media of mediaRows) {
          try {
            const mediaIdStr = await uploadMediaToX(
              media.url,
              media.type,
              media.size_bytes || 0,
              accessToken
            );
            mediaIds.push(mediaIdStr);
          } catch (uploadErr: any) {
            console.error(`[PublishTask] Failed uploading media ${media.url} to X:`, uploadErr.message);
            throw new Error(`Media upload failed: ${uploadErr.message}`);
          }
        }

        // ── Build tweet body ──────────────────────────────────────────
        const tweetBody: any = { text: post.content };
        if (mediaIds.length > 0) {
          tweetBody.media = { media_ids: mediaIds };
        }

        // ── Post to X API ─────────────────────────────────────────────
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

        // ── Mark as posted ─────────────────────────────────────────────
        await query(
          `UPDATE public.posts 
           SET status = $1, x_post_id = $2, error_message = null 
           WHERE id = $3`,
          ["posted", tweetId ?? null, post.id]
        );

        // ── Increment usage counter ────────────────────────────────────
        await incrementUsage(post.user_id);

        published++;
        console.log(`[PublishTask] ✅ Published post ${post.id} → X tweet ${tweetId}`);

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[PublishTask] ❌ Failed post ${post.id}:`, message);

        await query(
          `UPDATE public.posts 
           SET status = $1, error_message = $2 
           WHERE id = $3`,
          ["failed", message.slice(0, 500), post.id]
        );

        failed++;
      }
    }

    console.log(`[PublishTask] Done. Published: ${published}, Failed: ${failed}`);
    return { published, failed };
  },
});
