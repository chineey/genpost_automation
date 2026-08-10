import { createUploadthing, type FileRouter } from "uploadthing/next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

const f = createUploadthing();

export const ourFileRouter = {
  mediaUploader: f({
    image: { maxFileSize: "4MB", maxFileCount: 4 },
    video: { maxFileSize: "16MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const session = await getServerSession(authOptions);
      const userId = (session?.user as any)?.id;

      if (!userId) throw new Error("Unauthorized");

      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for userId:", metadata.userId);
      console.log("file url", file.url);

      const fileType = file.type.startsWith("video") ? "video" : "image";
      
      const rows = await query(
        `INSERT INTO public.media (user_id, url, file_key, type, size_bytes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [metadata.userId, file.url, file.key, fileType, file.size]
      );
      
      const mediaId = rows[0]?.id;

      return { uploadedBy: metadata.userId, mediaId, url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
