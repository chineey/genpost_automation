import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

// DELETE /api/media — Delete media from database and UploadThing storage
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mediaId = searchParams.get("id");

    if (!mediaId) {
      return NextResponse.json({ error: "Missing media ID" }, { status: 400 });
    }

    // 1. Fetch media record to verify ownership and retrieve file_key
    const mediaRows = await query(
      "SELECT id, file_key FROM public.media WHERE id = $1 AND user_id = $2",
      [mediaId, userId]
    );
    const media = mediaRows[0];

    if (!media) {
      return NextResponse.json({ error: "Media not found or unauthorized" }, { status: 404 });
    }

    // 2. Delete file from UploadThing storage if a file_key is available
    if (media.file_key) {
      try {
        console.log(`[MediaDelete] Deleting file from UploadThing: ${media.file_key}`);
        await utapi.deleteFiles(media.file_key);
      } catch (utErr: any) {
        console.error(`[MediaDelete] Failed to delete file ${media.file_key} from UploadThing:`, utErr.message);
        // Continue database deletion even if UploadThing API fails to prevent DB state freeze
      }
    }

    // 3. Delete from public.media (cascade will clean up post_media associations)
    await query("DELETE FROM public.media WHERE id = $1", [mediaId]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/media error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
