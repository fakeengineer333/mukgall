import { createClient } from "@/lib/supabase/client";

export type StorageBucket = "avatars" | "gallery-images" | "chat-images";

/**
 * Upload a file to a Supabase Storage bucket
 * @param bucket Bucket name ('avatars' | 'gallery-images' | 'chat-images')
 * @param path File path inside the bucket (e.g., `${userId}/${timestamp}-${file.name}`)
 * @param file File object or Blob
 * @returns Public URL of the uploaded image
 */
export async function uploadImageToStorage(
  bucket: StorageBucket,
  path: string,
  file: File | Blob
): Promise<{ url: string | null; error: string | null }> {
  try {
    const supabase = createClient();

    // Sanitize path
    const sanitizedPath = path.replace(/[^a-zA-Z0-9/._-]/g, "_");

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(sanitizedPath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      console.error(`[Storage Error] Upload to ${bucket} failed:`, error);
      return { url: null, error: error.message };
    }

    // Retrieve public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return { url: publicUrl, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown storage upload error";
    console.error(`[Storage Exception] Upload to ${bucket} failed:`, err);
    return { url: null, error: message };
  }
}
