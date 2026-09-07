import { DocumentExtractor, ExtractedContent } from './base';

export class PlainTextExtractor implements DocumentExtractor {
  canExtract(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext === 'txt' || ext === 'text' || ext === 'log';
  }

  async extract(input: Buffer | string, filename: string): Promise<ExtractedContent> {
    const raw = typeof input === 'string' ? input : input.toString('utf-8');
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    if (normalized.length === 0) {
      throw new Error(`Text extraction failed: '${filename}' is empty.`);
    }

    return {
      text: normalized,
      metadata: {
        characterCount: normalized.length,
        charCount: normalized.length,
        wordCount: normalized.split(/\s+/).filter(Boolean).length,
        lineCount: normalized.split('\n').length,
        estimatedTokens: Math.ceil(normalized.length / 4),
      },
      detectedType: 'txt',
    };
  }
}
