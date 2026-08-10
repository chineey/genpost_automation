"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { UploadDropzone } from "@/lib/uploadthing";

type PostStatus = "draft" | "approved" | "posted" | "failed";

interface MediaItem {
  id: string;
  url: string;
  file_key: string | null;
  type: string;
  size_bytes?: number;
}

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
  media?: MediaItem[];
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

  // Edit Modal State
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = filter === "all" ? posts : posts.filter((p) => p.status === filter);

  async function updateStatus(postId: string, newStatus: PostStatus, scheduledTime?: string | null) {
    setUpdatingId(postId);
    try {
      const payload: any = { id: postId, status: newStatus };
      if (scheduledTime !== undefined) {
        payload.scheduled_time = scheduledTime;
      }
      const res = await fetch("/api/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update status");
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      await fetchData();
      setUpdatingId(null);
    }
  }

  async function updateSchedule(postId: string, scheduledTime: string) {
    try {
      await fetch("/api/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: postId, scheduled_time: scheduledTime }),
      });
    } catch (err) {
      console.error("Failed to update schedule:", err);
    } finally {
      await fetchData();
    }
  }

  async function deletePost(postId: string) {
    if (!confirm("Delete this post?")) return;
    await fetch(`/api/posts?id=${postId}`, {
      method: "DELETE",
    });
    await fetchData();
  }

  // Save edits from the Modal
  async function handleSaveEdit() {
    if (!editingPost) return;
    setIsSavingEdit(true);
    setEditError("");

    try {
      const mediaIds = editingPost.media?.map((m) => m.id) ?? [];
      const res = await fetch("/api/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPost.id,
          content: editingPost.content,
          scheduled_time: editingPost.scheduled_time,
          media_ids: mediaIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save changes");
      }

      setEditingPost(null);
      await fetchData();
    } catch (err: any) {
      setEditError(err.message || "An error occurred");
    } finally {
      setIsSavingEdit(false);
    }
  }

  // Remove media locally in the edit staging list
  function handleRemoveMediaLocal(mediaId: string) {
    if (!editingPost) return;
    setEditingPost({
      ...editingPost,
      media: editingPost.media?.filter((m) => m.id !== mediaId) ?? [],
    });
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

                  {/* Media Grid list view */}
                  {post.media && post.media.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                      {post.media.map((m) => (
                        <div key={m.id} style={{ position: "relative", width: 64, height: 64, borderRadius: 8, overflow: "hidden", border: "1px solid var(--bg-border)", background: "var(--bg-elevated)" }}>
                          {m.type === "video" ? (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                              📹
                            </div>
                          ) : (
                            <img src={m.url} alt="Attached media" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {post.status === "draft" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Schedule:</span>
                      <input
                        id={`schedule-${post.id}`}
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
                  {/* Edit post */}
                  {post.status !== "posted" && (
                    <button
                      onClick={() => setEditingPost(post)}
                      className="btn-secondary"
                      style={{ padding: "7px 14px", fontSize: "0.78rem" }}
                    >
                      ✏️ Edit
                    </button>
                  )}
                  {post.status === "draft" && (
                    <button
                      onClick={() => {
                        const inputEl = document.getElementById(`schedule-${post.id}`) as HTMLInputElement;
                        const scheduledTime = inputEl?.value ? new Date(inputEl.value).toISOString() : null;
                        updateStatus(post.id, "approved", scheduledTime);
                      }}
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

      {/* Edit Modal (Glassmorphic Backdrop) */}
      {editingPost && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(9, 9, 11, 0.8)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="card glass"
            style={{
              width: "100%",
              maxWidth: 580,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              boxShadow: "var(--glow-orange-sm)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                ✏️ Edit Post
              </h3>
              <button
                onClick={() => setEditingPost(null)}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 20, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {editError && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "#F87171",
                  borderRadius: 8,
                  fontSize: "0.8rem",
                }}
              >
                {editError}
              </div>
            )}

            {/* Post Content Input */}
            <div className="form-group">
              <label className="label">Caption</label>
              <textarea
                className="textarea"
                value={editingPost.content}
                onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                style={{ minHeight: 120, fontSize: "0.9rem" }}
                placeholder="What's on your mind?"
              />
            </div>

            {/* Scheduled Time Input (only editable if draft or approved) */}
            <div className="form-group">
              <label className="label">Scheduled Time</label>
              <input
                type="datetime-local"
                className="input"
                value={editingPost.scheduled_time?.slice(0, 16) ?? ""}
                onChange={(e) =>
                  setEditingPost({
                    ...editingPost,
                    scheduled_time: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </div>

            {/* Attached Media Grid */}
            <div className="form-group">
              <label className="label" style={{ marginBottom: 8 }}>Attached Media</label>
              
              {editingPost.media && editingPost.media.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
                  {editingPost.media.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        position: "relative",
                        aspectRatio: "1",
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid var(--bg-border)",
                        background: "var(--bg-elevated)",
                      }}
                    >
                      {m.type === "video" ? (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                          📹
                        </div>
                      ) : (
                        <img src={m.url} alt="Thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                      
                      {/* Delete Media Pin */}
                      <button
                        onClick={() => handleRemoveMediaLocal(m.id)}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "rgba(239, 68, 68, 0.9)",
                          border: "none",
                          color: "#FFF",
                          fontSize: 10,
                          fontWeight: "bold",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                        }}
                        title="Remove attachment"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 12 }}>No media attached.</p>
              )}

              {/* Upload Uploader Component */}
              <div style={{ border: "1px dashed var(--bg-border)", borderRadius: 12, overflow: "hidden" }}>
                <UploadDropzone
                  endpoint="mediaUploader"
                  onClientUploadComplete={(res) => {
                    if (res && res.length > 0) {
                      const newMediaItems: MediaItem[] = res.map((file) => ({
                        id: (file.serverData as any)?.mediaId,
                        url: file.url,
                        file_key: file.key,
                        type: file.name.endsWith(".mp4") || file.name.endsWith(".mov") ? "video" : "image",
                      }));
                      
                      setEditingPost({
                        ...editingPost,
                        media: [...(editingPost.media ?? []), ...newMediaItems],
                      });
                    }
                  }}
                  onUploadError={(error: Error) => {
                    setEditError(`Upload error: ${error.message}`);
                  }}
                />
              </div>
            </div>

            {/* Modal Controls */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 10 }}>
              <button
                onClick={() => setEditingPost(null)}
                className="btn-secondary"
                disabled={isSavingEdit}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="btn-primary"
                disabled={isSavingEdit}
              >
                {isSavingEdit ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
