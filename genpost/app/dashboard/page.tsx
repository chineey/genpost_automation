"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type PostStatus = "draft" | "approved" | "posted" | "failed";

interface MediaItem {
  id: string;
  url: string;
  fileKey: string;
  type: "image" | "video";
  position: number;
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

// ─── Component: MediaGrid (Unified preview + remove capability) ───────────
function MediaGrid({ media, onRemove }: { media: MediaItem[]; onRemove?: (id: string) => void }) {
  if (!media || media.length === 0) return null;

  const gridContainerStyle: React.CSSProperties = {
    display: "grid",
    gap: "10px",
    borderRadius: "12px",
    overflow: "hidden",
    marginTop: "12px",
    border: "1px solid var(--bg-border)",
    background: "var(--bg-surface)",
    maxHeight: "360px",
  };

  const itemStyle = (ratio: string): React.CSSProperties => ({
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: "160px",
    aspectRatio: ratio,
    overflow: "hidden",
  });

  const mediaElStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "8px",
    display: "block",
  };

  const removeBtnStyle: React.CSSProperties = {
    position: "absolute",
    top: "8px",
    right: "8px",
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "rgba(9, 9, 11, 0.8)",
    border: "1px solid var(--bg-border)",
    color: "#FAFAFA",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "1.1rem",
    lineHeight: 1,
    transition: "background 0.2s, transform 0.1s",
    zIndex: 10,
  };

  // Determine if it is a video (either by type property or file extension)
  const isVideo = media[0].type === "video" || media[0].url.toLowerCase().endsWith(".mp4") || media[0].url.toLowerCase().endsWith(".webm");

  if (isVideo) {
    return (
      <div style={gridContainerStyle}>
        <div style={{ ...itemStyle("16/9"), maxHeight: "320px" }}>
          <video src={media[0].url} controls style={mediaElStyle} />
          {onRemove && (
            <button style={removeBtnStyle} onClick={() => onRemove(media[0].id)} title="Remove video">
              ×
            </button>
          )}
        </div>
      </div>
    );
  }

  // Multi-image grid layouts (X style)
  let gridTemplate = "1fr";
  if (media.length === 2) {
    gridTemplate = "1fr 1fr";
  } else if (media.length === 3) {
    gridTemplate = "2fr 1fr";
  } else if (media.length === 4) {
    gridTemplate = "1fr 1fr";
  }

  return (
    <div style={{ ...gridContainerStyle, gridTemplateColumns: gridTemplate }}>
      {media.length === 3 ? (
        <>
          <div style={itemStyle("1/1")}>
            <img src={media[0].url} alt="Media 1" style={mediaElStyle} />
            {onRemove && <button style={removeBtnStyle} onClick={() => onRemove(media[0].id)}>×</button>}
          </div>
          <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: "10px" }}>
            <div style={{ ...itemStyle("16/9"), minHeight: "75px" }}>
              <img src={media[1].url} alt="Media 2" style={mediaElStyle} />
              {onRemove && <button style={removeBtnStyle} onClick={() => onRemove(media[1].id)}>×</button>}
            </div>
            <div style={{ ...itemStyle("16/9"), minHeight: "75px" }}>
              <img src={media[2].url} alt="Media 3" style={mediaElStyle} />
              {onRemove && <button style={removeBtnStyle} onClick={() => onRemove(media[2].id)}>×</button>}
            </div>
          </div>
        </>
      ) : (
        media.map((m, idx) => {
          let ratio = "16/9";
          if (media.length === 1) ratio = "16/9";
          else if (media.length === 2) ratio = "1/1";
          else if (media.length === 4) ratio = "1/1";

          return (
            <div key={m.id} style={itemStyle(ratio)}>
              <img src={m.url} alt={`Media ${idx + 1}`} style={mediaElStyle} />
              {onRemove && <button style={removeBtnStyle} onClick={() => onRemove(m.id)}>×</button>}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Component: EditPostModal ─────────────────────────────────────────────
interface EditPostModalProps {
  post: Post;
  onClose: () => void;
  onSave: () => void;
}

function EditPostModal({ post, onClose, onSave }: EditPostModalProps) {
  const [content, setContent] = useState(post.content);
  const [scheduledTime, setScheduledTime] = useState(
    post.scheduled_time ? new Date(post.scheduled_time).toISOString().slice(0, 16) : ""
  );
  const [attachedMedia, setAttachedMedia] = useState<MediaItem[]>(post.media ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);

  const startUpload = async (files: File[]) => {
    setIsUploading(true);
    setErrorMessage(null);
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `Failed to upload ${file.name}`);
        }

        return response.json();
      });

      const results = await Promise.all(uploadPromises);

      const newItems: MediaItem[] = results.map((f, idx) => ({
        id: f.id,
        url: f.url,
        fileKey: f.fileKey,
        type: f.type,
        position: attachedMedia.length + idx
      }));

      setAttachedMedia(prev => {
        const combined = [...prev, ...newItems];
        const hasVideo = combined.some(m => m.type === "video");
        if (hasVideo) {
          const video = combined.find(m => m.type === "video")!;
          return [video];
        }
        return combined.slice(0, 4);
      });
    } catch (err: any) {
      setErrorMessage(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveMedia = (id: string) => {
    setAttachedMedia(prev => prev.filter(m => m.id !== id));
  };

  const handleSave = async () => {
    if (!content.trim()) {
      setErrorMessage("Post content cannot be empty.");
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const targetStatus = scheduledTime ? "approved" : "draft";

      const res = await fetch("/api/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post.id,
          content,
          scheduled_time: scheduledTime ? new Date(scheduledTime).toISOString() : null,
          status: targetStatus,
          media_ids: attachedMedia.map(m => m.id),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save post.");
      }

      onSave();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const charLimit = 280;
  const isOverLimit = content.length > charLimit;

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h2 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700 }}>
            ✏️ Edit Post
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1.25rem" }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {errorMessage && (
            <div style={{ padding: "12px", background: "rgba(248, 113, 113, 0.1)", border: "1px solid rgba(248, 113, 113, 0.2)", borderRadius: "8px", color: "#F87171", fontSize: "0.85rem" }}>
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Caption Textarea */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              Caption
            </label>
            <textarea
              className="input"
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What do you want to share?"
              style={{ width: "100%", resize: "vertical", fontSize: "0.9rem", padding: "12px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", fontSize: "0.75rem", color: isOverLimit ? "#F87171" : "var(--text-muted)" }}>
              {content.length} / {charLimit}
            </div>
          </div>

          {/* Scheduled Picker */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              Schedule Time
            </label>
            <input
              type="datetime-local"
              className="input"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              style={{ width: "100%", fontSize: "0.85rem", padding: "8px 12px" }}
            />
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              Leave empty to keep as a manual draft. Set a time to schedule it.
            </span>
          </div>

          {/* Media upload grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              Attached Media
            </label>
            
            {/* Visual media layout */}
            <MediaGrid media={attachedMedia} onRemove={handleRemoveMedia} />

            {/* Custom styled File Upload dropzone */}
            {!(attachedMedia.length > 0 && attachedMedia[0].type === "video") && attachedMedia.length < 4 && (
              <label className={`media-upload-area ${isUploading ? "uploading" : ""}`}>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  style={{ display: "none" }}
                  disabled={isUploading || isSaving}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      startUpload(Array.from(e.target.files));
                    }
                  }}
                />
                <span style={{ fontSize: "1.75rem", cursor: "pointer" }}>
                  {isUploading ? "⏳" : "📁"}
                </span>
                <span style={{ fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
                  {isUploading ? "Uploading files..." : "Upload Images / Video"}
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  Supports up to 4 images (max 4MB each) or 1 video (max 16MB)
                </span>
              </label>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={isSaving || isUploading}
            style={{ padding: "8px 16px", fontSize: "0.85rem" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={isSaving || isUploading || isOverLimit}
            style={{ padding: "8px 16px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 8 }}
          >
            {isSaving && <span className="spinner" style={{ width: 14, height: 14 }} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DashboardPage Main Component ──────────────────────────────────────────
export default function DashboardPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filter, setFilter] = useState<PostStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

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
                  
                  {/* Post Content */}
                  <p style={{ fontSize: "0.9rem", lineHeight: 1.6, color: "var(--text-primary)", marginBottom: 10, wordBreak: "break-word" }}>
                    {post.content}
                  </p>

                  {/* Attached Media Grid */}
                  {post.media && post.media.length > 0 && (
                    <div style={{ marginBottom: 12, maxWidth: "480px" }}>
                      <MediaGrid media={post.media} />
                    </div>
                  )}

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
                  {/* Edit button shown only if not published yet */}
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

      {/* Edit Post Modal overlay portal */}
      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSave={() => {
            setEditingPost(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
