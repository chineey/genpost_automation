"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type PostStatus = "draft" | "approved" | "posted" | "failed";

interface Post {
  id: string;
  content: string;
  status: PostStatus;
  scheduled_time: string | null;
  contains_link: boolean;
  x_post_id: string | null;
  error_message: string | null;
  created_at: string;
  metadata?: { topic?: string; type?: string };
}

interface Profile {
  plan: string;
  monthly_post_quota: number;
  posts_used_this_cycle: number;
  x_username: string | null;
}

const STATUS_FILTERS: { key: PostStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "approved", label: "Approved" },
  { key: "posted", label: "Posted" },
  { key: "failed", label: "Failed" },
];

function StatusBadge({ status }: { status: PostStatus }) {
  const map: Record<PostStatus, string> = {
    draft: "badge-draft",
    approved: "badge-approved",
    posted: "badge-posted",
    failed: "badge-failed",
  };
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

export default function DashboardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filter, setFilter] = useState<PostStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/posts");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
        setProfile(data.profile ?? null);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = filter === "all" ? posts : posts.filter((p) => p.status === filter);

  async function updateStatus(postId: string, newStatus: PostStatus) {
    setUpdatingId(postId);
    await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: postId, status: newStatus }),
    });
    await fetchData();
    setUpdatingId(null);
  }

  async function updateSchedule(postId: string, scheduledTime: string) {
    await fetch("/api/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: postId, scheduled_time: scheduledTime }),
    });
    await fetchData();
  }

  async function deletePost(postId: string) {
    if (!confirm("Delete this post?")) return;
    await fetch(`/api/posts?id=${postId}`, {
      method: "DELETE",
    });
    await fetchData();
  }

  const usedPercent = profile
    ? Math.min(100, (profile.posts_used_this_cycle / profile.monthly_post_quota) * 100)
    : 0;

  if (loading) {
    return (
      <div style={{ padding: 40, display: "flex", flexDirection: "column", gap: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="responsive-padding" style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 6 }}>
            Your Posts
          </h1>
          {profile?.x_username && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="status-dot green" />
              <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                @{profile.x_username} connected
              </span>
            </div>
          )}
          {!profile?.x_username && (
            <Link href="/dashboard/connect-x" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--brand-orange-light)", fontSize: "0.85rem", textDecoration: "none", fontWeight: 500 }}>
              → Connect your X account to start posting
            </Link>
          )}
        </div>
        <Link href="/dashboard/new" className="btn-primary">
          ✨ Generate Posts
        </Link>
      </div>

      {/* Quota bar */}
      {profile && (
        <div
          className="card responsive-card"
          style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Posts used this cycle</span>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                {profile.posts_used_this_cycle} / {profile.monthly_post_quota}
              </span>
            </div>
            <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 9999, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${usedPercent}%`,
                  background: usedPercent > 80
                    ? "linear-gradient(90deg, #F87171, #EF4444)"
                    : "linear-gradient(90deg, #FF6B2B, #FFAA00)",
                  borderRadius: 9999,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
          <div>
            <span className={`badge badge-${profile.plan}`} style={{ textTransform: "capitalize" }}>
              {profile.plan} Plan
            </span>
          </div>
          {profile.plan === "free" && (
            <Link href="/dashboard/settings" className="btn-primary" style={{ padding: "8px 18px", fontSize: "0.8rem" }}>
              ↑ Upgrade
            </Link>
          )}
        </div>
      )}

      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((f) => {
          const count = f.key === "all" ? posts.length : posts.filter((p) => p.status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`chip ${filter === f.key ? "active" : ""}`}
            >
              {f.label}
              {count > 0 && (
                <span
                  style={{
                    background: filter === f.key ? "rgba(255,107,43,0.3)" : "var(--bg-border)",
                    borderRadius: 9999,
                    padding: "1px 7px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Posts list */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
          <p style={{ fontSize: "1rem", marginBottom: 8 }}>No {filter !== "all" ? filter : ""} posts yet</p>
          <Link href="/dashboard/new" className="btn-primary" style={{ display: "inline-flex", marginTop: 16 }}>
            ✨ Generate your first posts
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((post) => (
            <div
              key={post.id}
              className="card responsive-card"
            >
              <div className="post-card-container">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <StatusBadge status={post.status} />
                    {post.metadata?.topic && (
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 8px", borderRadius: 9999, border: "1px solid var(--bg-border)" }}>
                        {post.metadata.topic}
                      </span>
                    )}
                    {post.metadata?.type && (
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {post.metadata.type.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-primary)", marginBottom: 10, wordBreak: "break-word" }}>
                    {post.content}
                  </p>
                  {post.status === "draft" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Schedule:</span>
                      <input
                        type="datetime-local"
                        className="input"
                        style={{ width: "auto", padding: "4px 10px", fontSize: "0.78rem" }}
                        defaultValue={post.scheduled_time?.slice(0, 16) ?? ""}
                        onBlur={(e) => e.target.value && updateSchedule(post.id, new Date(e.target.value).toISOString())}
                      />
                    </div>
                  )}
                  {post.scheduled_time && post.status !== "posted" && (
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6 }}>
                      📅 {new Date(post.scheduled_time).toLocaleString()}
                    </p>
                  )}
                  {post.x_post_id && (
                    <a
                      href={`https://x.com/i/web/status/${post.x_post_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: "0.75rem", color: "var(--brand-orange-light)", textDecoration: "none" }}
                    >
                      → View on X ↗
                    </a>
                  )}
                  {post.error_message && (
                    <p style={{ fontSize: "0.75rem", color: "#F87171", marginTop: 6 }}>
                      ⚠️ {post.error_message}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="post-card-actions">
                  {post.status === "draft" && (
                    <button
                      onClick={() => updateStatus(post.id, "approved")}
                      className="btn-primary"
                      disabled={updatingId === post.id}
                      style={{ padding: "7px 14px", fontSize: "0.78rem" }}
                    >
                      {updatingId === post.id ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "✓ Approve"}
                    </button>
                  )}
                  {post.status === "approved" && (
                    <button
                      onClick={() => updateStatus(post.id, "draft")}
                      className="btn-secondary"
                      style={{ padding: "7px 14px", fontSize: "0.78rem" }}
                    >
                      ← Unschedule
                    </button>
                  )}
                  {post.status === "failed" && (
                    <button
                      onClick={() => updateStatus(post.id, "approved")}
                      className="btn-secondary"
                      style={{ padding: "7px 14px", fontSize: "0.78rem" }}
                    >
                      ↺ Retry
                    </button>
                  )}
                  <button
                    onClick={() => deletePost(post.id)}
                    className="btn-danger"
                    style={{ padding: "7px 14px", fontSize: "0.78rem" }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
