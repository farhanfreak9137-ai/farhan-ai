export interface PageContent {
  pageNumber: number;
  text: string;
}

export interface ExtractedContent {
  text: string;
  pages?: PageContent[];
  metadata: Record<string, unknown>;
  detectedType: string;
}

export interface DocumentExtractor {
  canExtract(filename: string, mimeType?: string): boolean;
  extract(input: Buffer | string, filename: string): Promise<ExtractedContent>;
}
