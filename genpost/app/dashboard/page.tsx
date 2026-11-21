"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ExternalLink, Trash2, Pencil, X, Check, Undo2, RotateCcw, Loader2, ImagePlus, Sparkles, TriangleAlert, CalendarClock } from "lucide-react";

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

const BADGE: Record<PostStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-accent text-accent-foreground",
  posted: "bg-success/15 text-success",
  failed: "bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: PostStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${BADGE[status]}`}>{status}</span>;
}

// ─── MediaGrid (preview + optional remove) ────────────────────────────────
function MediaGrid({ media, onRemove }: { media: MediaItem[]; onRemove?: (id: string) => void }) {
  if (!media || media.length === 0) return null;

  const RemoveBtn = ({ id }: { id: string }) =>
    onRemove ? (
      <button
        type="button"
        onClick={() => onRemove(id)}
        title="Remove"
        className="absolute top-2 right-2 z-10 grid size-7 place-items-center rounded-full bg-ink/80 text-ink-foreground hover:bg-ink"
      >
        <X className="size-4" />
      </button>
    ) : null;

  const wrap = "mt-3 grid gap-2 overflow-hidden rounded-xl border bg-muted";
  const img = "size-full rounded-lg object-cover";

  const first = media[0];
  const isVideo = first.type === "video" || /\.(mp4|webm)$/i.test(first.url);

  if (isVideo) {
    return (
      <div className={wrap}>
        <div className="relative aspect-video max-h-80">
          <video src={first.url} controls className={img} />
          <RemoveBtn id={first.id} />
        </div>
      </div>
    );
  }

  if (media.length === 3) {
    return (
      <div className={`${wrap} grid-cols-[2fr_1fr]`}>
        <div className="relative min-h-40">
          <img src={media[0].url} alt="Media 1" className={img} />
          <RemoveBtn id={media[0].id} />
        </div>
        <div className="grid grid-rows-2 gap-2">
          {[media[1], media[2]].map((m, i) => (
            <div key={m.id} className="relative min-h-20">
              <img src={m.url} alt={`Media ${i + 2}`} className={img} />
              <RemoveBtn id={m.id} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${wrap} ${media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
      {media.map((m, idx) => (
        <div key={m.id} className={`relative ${media.length === 1 ? "aspect-video" : "aspect-square"}`}>
          <img src={m.url} alt={`Media ${idx + 1}`} className={img} />
          <RemoveBtn id={m.id} />
        </div>
      ))}
    </div>
  );
}

// ─── EditPostModal ─────────────────────────────────────────────────────────
function EditPostModal({ post, onClose, onSave }: { post: Post; onClose: () => void; onSave: () => void }) {
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
      const results = await Promise.all(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          const response = await fetch("/api/media/upload", { method: "POST", body: formData });
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `Failed to upload ${file.name}`);
          }
          return response.json();
        })
      );

      const newItems: MediaItem[] = results.map((f, idx) => ({
        id: f.id,
        url: f.url,
        fileKey: f.fileKey,
        type: f.type,
        position: attachedMedia.length + idx,
      }));

      setAttachedMedia((prev) => {
        const combined = [...prev, ...newItems];
        const video = combined.find((m) => m.type === "video");
        if (video) return [video];
        return combined.slice(0, 4);
      });
    } catch (err: any) {
      setErrorMessage(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveMedia = (id: string) => setAttachedMedia((prev) => prev.filter((m) => m.id !== id));

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
          media_ids: attachedMedia.map((m) => m.id),
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
  const hasVideo = attachedMedia.length > 0 && attachedMedia[0].type === "video";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4" onClick={onClose}>
      <div className="panel max-h-[90vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex justify-between">
          <h2 className="text-xl font-bold">Edit post</h2>
          <button onClick={onClose} aria-label="Close"><X className="size-5" /></button>
        </div>

        {errorMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />{errorMessage}
          </div>
        )}

        <textarea className="field min-h-36" value={content} onChange={(e) => setContent(e.target.value)} placeholder="What do you want to share?" />
        <p className={`mt-1 text-right text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>{content.length}/{charLimit}</p>

        <label className="mt-3 block text-sm font-medium">Schedule</label>
        <input type="datetime-local" className="field mt-1" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">Leave empty to keep as a manual draft. Set a time to schedule it.</p>

        <label className="mt-4 block text-sm font-medium">
          Media <span className="font-normal text-muted-foreground">(up to 4 images or 1 video)</span>
        </label>
        <MediaGrid media={attachedMedia} onRemove={handleRemoveMedia} />
        {!hasVideo && attachedMedia.length < 4 && (
          <label className={`mt-3 flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-6 text-center hover:border-primary ${isUploading ? "pointer-events-none opacity-60" : ""}`}>
            <input
              type="file"
              multiple
              hidden
              accept="image/*,video/*"
              disabled={isUploading || isSaving}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) startUpload(Array.from(e.target.files));
              }}
            />
            {isUploading ? <Loader2 className="size-6 animate-spin text-primary" /> : <ImagePlus className="size-6 text-primary" />}
            <span className="text-sm font-semibold">{isUploading ? "Uploading files..." : "Upload images / video"}</span>
            <span className="text-xs text-muted-foreground">Up to 4 images (max 4MB each) or 1 video (max 16MB)</span>
          </label>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} disabled={isSaving || isUploading} className="btn btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={isSaving || isUploading || isOverLimit} className="btn btn-loud">
            {isSaving && <Loader2 className="size-4 animate-spin" />}Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
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
    await fetch(`/api/posts?id=${postId}`, { method: "DELETE" });
    await fetchData();
  }

  const usedPercent = profile ? Math.min(100, (profile.posts_used_this_cycle / profile.monthly_post_quota) * 100) : 0;

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Your posts</h1>
          {profile?.x_username ? (
            <p className="flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full bg-success" />@{profile.x_username} connected</p>
          ) : (
            <p className="text-muted-foreground">Review, schedule and publish.</p>
          )}
        </div>
        <div className="flex gap-2">
          {!profile?.x_username && <Link href="/dashboard/connect-x" className="btn btn-ghost">Connect X</Link>}
          <Link href="/dashboard/new" className="btn btn-loud"><Sparkles className="size-4" />Generate posts</Link>
        </div>
      </div>

      {profile && (
        <div className="panel mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">
              Monthly quota <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground capitalize">{profile.plan}</span>
            </span>
            <span className="text-muted-foreground">
              {profile.posts_used_this_cycle} / {profile.monthly_post_quota} posts
              {profile.plan === "free" && <> · <Link href="/dashboard/settings" className="text-primary">Upgrade</Link></>}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full transition-all ${usedPercent > 80 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${usedPercent}%` }} />
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const count = f.key === "all" ? posts.length : posts.filter((p) => p.status === f.key).length;
          return (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`chip ${filter === f.key ? "chip-on" : ""}`}>
              {f.label} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 && (
          <div className="panel p-10 text-center text-muted-foreground">
            <p>No {filter !== "all" ? filter : ""} posts yet.</p>
            <Link href="/dashboard/new" className="btn btn-loud mt-4"><Sparkles className="size-4" />Generate your first posts</Link>
          </div>
        )}
        {filtered.map((post) => (
          <div key={post.id} className="panel flex flex-col gap-4 p-5 sm:flex-row">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
                <StatusBadge status={post.status} />
                {post.metadata?.topic && <span className="rounded-full border bg-background px-2 py-0.5 text-muted-foreground">{post.metadata.topic}</span>}
                {post.metadata?.type && <span className="text-muted-foreground capitalize">{post.metadata.type.replace("_", " ")}</span>}
                {post.scheduled_time && post.status !== "posted" && (
                  <span className="flex items-center gap-1 text-muted-foreground"><CalendarClock className="size-3" />{new Date(post.scheduled_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                )}
              </div>
              <p className="text-sm break-words whitespace-pre-line">{post.content}</p>

              {post.media && post.media.length > 0 && <div className="max-w-md"><MediaGrid media={post.media} /></div>}

              {post.status === "draft" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Schedule:</span>
                  <input
                    type="datetime-local"
                    className="field !w-auto !py-1 !text-xs"
                    defaultValue={post.scheduled_time?.slice(0, 16) ?? ""}
                    onBlur={(e) => e.target.value && updateSchedule(post.id, new Date(e.target.value).toISOString())}
                  />
                </div>
              )}
              {post.x_post_id && (
                <a href={`https://x.com/i/web/status/${post.x_post_id}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                  View on X <ExternalLink className="size-3" />
                </a>
              )}
              {post.error_message && (
                <p className="mt-2 flex items-center gap-1 text-xs text-destructive"><TriangleAlert className="size-3" />{post.error_message}</p>
              )}
            </div>

            <div className="flex shrink-0 flex-row flex-wrap items-start gap-1 sm:flex-col sm:items-end">
              {post.status === "draft" && (
                <button onClick={() => updateStatus(post.id, "approved")} disabled={updatingId === post.id} className="btn btn-loud px-3 py-1.5 text-xs">
                  {updatingId === post.id ? <Loader2 className="size-3 animate-spin" /> : <><Check className="size-3" />Approve</>}
                </button>
              )}
              {post.status === "approved" && (
                <button onClick={() => updateStatus(post.id, "draft")} className="btn btn-ghost px-3 py-1.5 text-xs"><Undo2 className="size-3" />Unschedule</button>
              )}
              {post.status === "failed" && (
                <button onClick={() => updateStatus(post.id, "approved")} className="btn btn-ghost px-3 py-1.5 text-xs"><RotateCcw className="size-3" />Retry</button>
              )}
              <div className="flex gap-1">
                {post.status !== "posted" && (
                  <button onClick={() => setEditingPost(post)} className="rounded-lg p-2 hover:bg-muted" aria-label="Edit"><Pencil className="size-4" /></button>
                )}
                <button onClick={() => deletePost(post.id)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10" aria-label="Delete"><Trash2 className="size-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

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
