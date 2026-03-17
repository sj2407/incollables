/**
 * Client-side Word → HTML converter for learning materials (résumés, fiches).
 * Uses mammoth.js to convert .docx to clean HTML for inline display.
 */

import mammoth from 'mammoth';

export interface LearningMaterialParsed {
  title: string;
  contentHtml: string;
  fileName: string;
  fileSize: number;
}

/**
 * Convert a .docx file to HTML content for inline viewing.
 * Images are embedded as base64 data URIs.
 */
export async function parseWordToHtml(file: File): Promise<LearningMaterialParsed> {
  const buffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const imageBuffer = await image.read();
        const bytes = new Uint8Array(imageBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const contentType = image.contentType || 'image/png';
        return { src: `data:${contentType};base64,${base64}` };
      }),
    }
  );

  // Derive title from filename (strip extension)
  const title = file.name.replace(/\.docx?$/i, '').replace(/[_-]/g, ' ').trim();

  return {
    title,
    contentHtml: result.value,
    fileName: file.name,
    fileSize: file.size,
  };
}

/**
 * Extract a YouTube video ID from various URL formats.
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
