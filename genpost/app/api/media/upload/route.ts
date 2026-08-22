import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import cloudinary from "@/lib/cloudinary";

export async function POST(request: Request) {
  try {
    // 1. Authenticate the user
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse the request FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isImage && !isVideo) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    // 3. Enforce size limits (Images <= 4MB, Videos <= 16MB)
    const maxLimit = isVideo ? 16 * 1024 * 1024 : 4 * 1024 * 1024;
    if (file.size > maxLimit) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${isVideo ? "16MB" : "4MB"}.` },
        { status: 400 }
      );
    }

    // 4. Convert file arrayBuffer to base64 Data URI
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64File = `data:${file.type};base64,${buffer.toString("base64")}`;

    // 5. Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(base64File, {
      resource_type: isVideo ? "video" : "image",
      folder: "home/genpost",
    });

    const type = isVideo ? "video" : "image";

    // 6. Save metadata to the public.media table
    const rows = await query(
      `INSERT INTO public.media (user_id, url, file_key, type, size_bytes, width, height)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, url, file_key, type, size_bytes`,
      [
        userId,
        uploadResult.secure_url,
        uploadResult.public_id,
        type,
        file.size,
        uploadResult.width || null,
        uploadResult.height || null,
      ]
    );

    const mediaRecord = rows[0];

    return NextResponse.json({
      id: mediaRecord.id,
      url: mediaRecord.url,
      fileKey: mediaRecord.file_key,
      type: mediaRecord.type,
    });
  } catch (error: any) {
    console.error("[Cloudinary Upload Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file to Cloudinary" },
      { status: 500 }
    );
  }
}
