import mammoth from 'mammoth';

/**
 * Extracts plain text from a DOCX file, preserving paragraph breaks.
 * Uses mammoth to parse the DOCX binary and convert to raw text.
 */
export async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
