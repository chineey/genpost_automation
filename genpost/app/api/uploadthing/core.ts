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
      
      if (!userId) {
        throw new Error("Unauthorized");
      }
      
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const type = file.type.startsWith("video") ? "video" : "image";
      
      // Insert into our Neon Postgres 'media' table
      const rows = await query(
        `INSERT INTO public.media (user_id, url, file_key, type, size_bytes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, url, file_key, type, size_bytes`,
        [metadata.userId, file.url, file.key, type, file.size]
      );
      
      const mediaRecord = rows[0];
      console.log("[UploadThing] callback completed. Created media record:", mediaRecord);
      
      return {
        mediaId: mediaRecord.id,
        url: file.url,
        fileKey: file.key,
        type: type,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
