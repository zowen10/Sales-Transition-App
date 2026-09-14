import JSZip from 'jszip';
import path from 'node:path';

/**
 * Extracts plain text from an uploaded document for use as context in
 * intake prepopulation. Supports .txt and .docx. Unsupported formats
 * (PDF, images, etc.) return null — a documented limitation, not a failure.
 */
export async function extractDocumentText(buffer: Buffer, filename: string): Promise<string | null> {
  const ext = path.extname(filename).toLowerCase();
  try {
    if (ext === '.txt' || ext === '.md') {
      return buffer.toString('utf-8');
    }
    if (ext === '.docx') {
      const zip = await JSZip.loadAsync(buffer);
      const xmlFile = zip.file('word/document.xml');
      if (!xmlFile) return null;
      const xml = await xmlFile.async('text');
      const withBreaks = xml.replace(/<\/w:p>/g, '</w:p>\n');
      const text = withBreaks
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      return text.trim();
    }
    return null;
  } catch {
    return null;
  }
}
