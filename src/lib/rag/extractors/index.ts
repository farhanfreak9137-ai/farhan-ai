import { DocumentExtractor, ExtractedContent } from './base';
import { PlainTextExtractor } from './plain-text';
import { MarkdownExtractor } from './markdown';
import { JsonExtractor } from './json';
import { PdfExtractor } from './pdf';

export * from './base';
export * from './plain-text';
export * from './markdown';
export * from './json';
export * from './pdf';

export class ExtractorRegistry {
  private static extractors: DocumentExtractor[] = [
    new PlainTextExtractor(),
    new MarkdownExtractor(),
    new JsonExtractor(),
    new PdfExtractor(),
  ];

  public static getExtractor(filename: string, mimeType?: string): DocumentExtractor {
    const extractor = this.extractors.find((e) => e.canExtract(filename, mimeType));
    if (!extractor) {
      const ext = filename.split('.').pop()?.toLowerCase() || 'unknown';
      throw new Error(`Unsupported document format '.${ext}'. Supported formats: .txt, .md, .json, .pdf`);
    }
    return extractor;
  }

  public static async extract(input: Buffer | string, filename: string): Promise<ExtractedContent> {
    const extractor = this.getExtractor(filename);
    return extractor.extract(input, filename);
  }
}
