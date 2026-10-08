/** Read a file as base64 (no `data:` prefix) for the JSON import-preview request. */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

/** Replace markdown images with their alt text so the import preview never fetches remote URLs. */
export function stripImages(md: string): string {
  return md.replace(/!\[([^\]]*)\]\([^)]*\)/g, "[image: $1]");
}
