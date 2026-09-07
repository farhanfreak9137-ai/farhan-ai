import { DocumentExtractor, ExtractedContent } from './base';

export class MarkdownExtractor implements DocumentExtractor {
  canExtract(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext === 'md' || ext === 'markdown';
  }

  async extract(input: Buffer | string, filename: string): Promise<ExtractedContent> {
    const raw = typeof input === 'string' ? input : input.toString('utf-8');
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    if (normalized.length === 0) {
      throw new Error(`Markdown extraction failed: '${filename}' is empty.`);
    }

    // Extract headers for structural metadata
    const headers = normalized
      .split('\n')
      .filter((line) => /^#{1,6}\s+/.test(line))
      .map((line) => line.replace(/^#{1,6}\s+/, '').trim());

    return {
      text: normalized,
      metadata: {
        characterCount: normalized.length,
        lineCount: normalized.split('\n').length,
        headings: headers.slice(0, 10),
        sectionCount: headers.length,
      },
      detectedType: 'md',
    };
  }
}
