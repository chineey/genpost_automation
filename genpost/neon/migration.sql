-- ══════════════════════════════════════════════════════════════════
-- Genpost — Media Upload & Post Media Migration
-- Run this in: Neon Console → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ── Media Table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.users(id) ON DELETE CASCADE,
  url         text NOT NULL,          -- UploadThing public URL
  file_key    text,                  -- UploadThing file key, needed for deletion
  type        text NOT NULL,          -- 'image' | 'video' | 'gif'
  width       int,
  height      int,
  size_bytes  int,
  created_at  timestamptz DEFAULT now()
);

-- ── Post Media Join Table (for order & attachments) ──────────────
CREATE TABLE IF NOT EXISTS public.post_media (
  post_id     uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  media_id    uuid REFERENCES public.media(id) ON DELETE CASCADE,
  position    int NOT NULL,
  PRIMARY KEY (post_id, media_id)
);

-- ── Index for quick lookup of post media ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_post_media_post_id
  ON public.post_media(post_id);
