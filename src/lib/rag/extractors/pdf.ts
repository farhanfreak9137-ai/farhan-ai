import { DocumentExtractor, ExtractedContent, PageContent } from './base';

export class PdfExtractor implements DocumentExtractor {
  canExtract(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext === 'pdf';
  }

  async extract(input: Buffer | string, filename: string): Promise<ExtractedContent> {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf-8');

    if (buffer.length < 8) {
      throw new Error(`PDF extraction failed for '${filename}': File is too small or truncated.`);
    }

    const header = buffer.subarray(0, 10).toString('latin1');
    if (!header.startsWith('%PDF-')) {
      throw new Error(`Invalid PDF format for '${filename}': Missing %PDF- header signature.`);
    }

    // Native PDF Text Stream & Page Parser
    const extracted = this.extractNativePdfText(buffer);

    if (extracted.text.length === 0) {
      // Check if PDF contains raster images but no text
      const hasImages = buffer.includes(Buffer.from('/Image')) || buffer.includes(Buffer.from('/XObject'));
      if (hasImages) {
        throw new Error(`PDF extraction failed for '${filename}': Scanned document detected. OCR is not currently available.`);
      }
      throw new Error(`PDF contains no extractable text. Scanned document OCR is not currently available.`);
    }

    return {
      text: extracted.text,
      pages: extracted.pages.length > 0 ? extracted.pages : [{ pageNumber: 1, text: extracted.text }],
      metadata: {
        totalPages: Math.max(extracted.pages.length, 1),
        pdfVersion: header.trim(),
        characterCount: extracted.text.length,
        parserUsed: 'native_stream_parser',
      },
      detectedType: 'pdf',
    };
  }

  /**
   * Native PDF stream parser that scans page objects and extracts text operators.
   */
  private extractNativePdfText(buffer: Buffer): { text: string; pages: PageContent[] } {
    const contentStr = buffer.toString('latin1');
    const pages: PageContent[] = [];

    // Split on page markers or stream markers
    const pageChunks = contentStr.split(/\/Type\s*\/Page\b/);

    if (pageChunks.length > 1) {
      for (let i = 1; i < pageChunks.length; i++) {
        const pageChunk = pageChunks[i];
        const pageText = this.extractTextFromRawStream(pageChunk);
        if (pageText.trim().length > 0) {
          pages.push({
            pageNumber: i,
            text: pageText.trim(),
          });
        }
      }
    }

    // If no /Page splits succeeded, parse whole file streams
    if (pages.length === 0) {
      const allText = this.extractTextFromRawStream(contentStr);
      if (allText.trim().length > 0) {
        pages.push({
          pageNumber: 1,
          text: allText.trim(),
        });
      }
    }

    const fullText = pages.map((p) => p.text).join('\n\n').trim();
    return { text: fullText, pages };
  }

  /**
   * Extracts text from PDF BT ... ET blocks with Tj, TJ, and ' / " operators.
   */
  private extractTextFromRawStream(raw: string): string {
    const outputLines: string[] = [];

    // Match text blocks between BT (Begin Text) and ET (End Text)
    const btMatches = raw.matchAll(/\bBT\b([\s\S]*?)\bET\b/g);

    for (const match of btMatches) {
      const block = match[1];

      // Extract array strings: [(text) 20 (more text)] TJ
      const tjArrayRegex = /\[((?:[^(]*\([^)]*\)[^)]*)+)\]\s*TJ/g;
      let arrayMatch: RegExpExecArray | null;
      while ((arrayMatch = tjArrayRegex.exec(block)) !== null) {
        const inner = arrayMatch[1];
        const stringParts = inner.matchAll(/\(([^)]*)\)/g);
        const combined = Array.from(stringParts).map((m) => this.unescapePdfString(m[1])).join('');
        if (combined.trim()) {
          outputLines.push(combined.trim());
        }
      }

      // Extract single strings: (text) Tj or (text) ' or (text) "
      const singleStringRegex = /\(([^)]*)\)\s*(?:Tj|'|")/g;
      let singleMatch: RegExpExecArray | null;
      while ((singleMatch = singleStringRegex.exec(block)) !== null) {
        const str = this.unescapePdfString(singleMatch[1]);
        if (str.trim()) {
          outputLines.push(str.trim());
        }
      }

      // Extract hex strings: <48656C6C6F> Tj
      const hexStringRegex = /<([0-9A-Fa-f]+)>\s*(?:Tj|'|")/g;
      let hexMatch: RegExpExecArray | null;
      while ((hexMatch = hexStringRegex.exec(block)) !== null) {
        const decoded = this.decodeHexPdfString(hexMatch[1]);
        if (decoded.trim()) {
          outputLines.push(decoded.trim());
        }
      }
    }

    // Fallback: If no BT...ET blocks found, look for standalone literal parentheses strings
    if (outputLines.length === 0) {
      const fallbackStrings = raw.matchAll(/\(([^)]{4,})\)\s*(?:Tj|'|"|T\*)/g);
      for (const m of fallbackStrings) {
        const str = this.unescapePdfString(m[1]);
        if (str.trim()) {
          outputLines.push(str.trim());
        }
      }
    }

    return outputLines.join('\n');
  }

  private unescapePdfString(str: string): string {
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
  }

  private decodeHexPdfString(hex: string): string {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.substring(i, i + 2), 16);
      if (!isNaN(code) && code >= 32 && code <= 126) {
        str += String.fromCharCode(code);
      }
    }
    return str;
  }
}
