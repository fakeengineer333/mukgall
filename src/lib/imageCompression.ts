/**
 * Client-side Image Compression Utility using Canvas API
 * Compresses and resizes images to WebP/JPEG before uploading to save storage & bandwidth.
 */
export async function compressImage(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8
): Promise<{ file: File; previewUrl: string }> {
  // If not an image (e.g. invalid type), return original
  if (!file.type.startsWith("image/")) {
    return { file, previewUrl: URL.createObjectURL(file) };
  }

  // If gif or svg, preserve original animation/vector
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return { file, previewUrl: URL.createObjectURL(file) };
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate scaling
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve({ file, previewUrl: URL.createObjectURL(file) });
        }

        // High quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to webp with fallback to jpeg
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve({ file, previewUrl: URL.createObjectURL(file) });
            }

            const cleanFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const compressedFile = new File([blob], cleanFileName, {
              type: "image/webp",
              lastModified: Date.now(),
            });

            const previewUrl = URL.createObjectURL(compressedFile);
            resolve({ file: compressedFile, previewUrl });
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => resolve({ file, previewUrl: URL.createObjectURL(file) });
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve({ file, previewUrl: URL.createObjectURL(file) });
    reader.readAsDataURL(file);
  });
}
