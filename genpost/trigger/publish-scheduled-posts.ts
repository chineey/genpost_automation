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

        // ── Post to X API ─────────────────────────────────────────────
        const xResponse = await fetch("https://api.x.com/2/tweets", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: post.content }),
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
