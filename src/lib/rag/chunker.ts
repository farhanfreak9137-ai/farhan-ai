import { DocumentChunk } from './types';
import { PageContent } from './extractors/base';

export interface ChunkerOptions {
  chunkSize?: number; // target tokens (default: 400 tokens ~ 1600 chars)
  chunkOverlap?: number; // overlap tokens (default: 80 tokens ~ 320 chars)
}

export class TextChunker {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(options: ChunkerOptions = {}) {
    this.chunkSize = options.chunkSize || 400;
    this.chunkOverlap = options.chunkOverlap !== undefined ? options.chunkOverlap : 80;

    if (this.chunkOverlap >= this.chunkSize) {
      this.chunkOverlap = Math.floor(this.chunkSize / 4);
    }
  }

  /**
   * Chunks document text deterministically, preserving page and source metadata.
   */
  public chunkDocument(params: {
    documentId: string;
    text: string;
    source: string;
    pages?: PageContent[];
    metadata?: Record<string, unknown>;
  }): DocumentChunk[] {
    const { documentId, text, source, pages, metadata = {} } = params;

    // If pages are provided and multiple pages exist, chunk by page
    if (pages && pages.length > 1) {
      const chunks: DocumentChunk[] = [];
      let globalIndex = 0;

      for (const page of pages) {
        const pageChunks = this.splitIntoChunks(page.text);
        for (const cText of pageChunks) {
          chunks.push({
            id: `${documentId}_chunk_${globalIndex}`,
            documentId,
            chunkIndex: globalIndex,
            content: cText,
            page: page.pageNumber,
            source,
            tokenEstimate: Math.ceil(cText.length / 4),
            metadata: {
              ...metadata,
              pageNumber: page.pageNumber,
            },
            createdAt: new Date().toISOString(),
          });
          globalIndex++;
        }
      }
      return chunks;
    }

    // Single document or no page splits
    const chunkTexts = this.splitIntoChunks(text);
    return chunkTexts.map((cText, idx) => ({
      id: `${documentId}_chunk_${idx}`,
      documentId,
      chunkIndex: idx,
      content: cText,
      page: pages?.[0]?.pageNumber || 1,
      source,
      tokenEstimate: Math.ceil(cText.length / 4),
      metadata: { ...metadata },
      createdAt: new Date().toISOString(),
    }));
  }

  /**
   * Deterministic semantic text splitter that prioritizes paragraph and sentence boundaries.
   */
  private splitIntoChunks(text: string): string[] {
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!cleanText) return [];

    const targetCharSize = this.chunkSize * 4;
    const overlapCharSize = this.chunkOverlap * 4;
    const stepSize = Math.max(targetCharSize - overlapCharSize, 100);

    // If text is already small enough, return as single chunk
    if (cleanText.length <= targetCharSize) {
      return [cleanText];
    }

    // Split into paragraphs
    const paragraphs = cleanText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    const units: string[] = [];

    for (const para of paragraphs) {
      if (para.length <= targetCharSize) {
        units.push(para);
      } else {
        // Split oversized paragraph into sentences
        const sentences = para.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
        for (const sentence of sentences) {
          if (sentence.length <= targetCharSize) {
            units.push(sentence);
          } else {
            // Split oversized sentence by words
            const words = sentence.split(/\s+/);
            let currentWordChunk = '';
            for (const word of words) {
              if ((currentWordChunk + ' ' + word).length > targetCharSize) {
                if (currentWordChunk.trim()) units.push(currentWordChunk.trim());
                currentWordChunk = word;
              } else {
                currentWordChunk = currentWordChunk ? `${currentWordChunk} ${word}` : word;
              }
            }
            if (currentWordChunk.trim()) units.push(currentWordChunk.trim());
          }
        }
      }
    }

    // Assemble units into chunks with overlap
    const chunks: string[] = [];
    let currentChunkUnits: string[] = [];
    let currentLength = 0;

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const addedLength = unit.length + (currentChunkUnits.length > 0 ? 2 : 0);

      if (currentLength + addedLength > targetCharSize && currentChunkUnits.length > 0) {
        chunks.push(currentChunkUnits.join('\n\n'));

        // Calculate overlap units to carry forward
        const overlapUnits: string[] = [];
        let overlapLen = 0;
        for (let j = currentChunkUnits.length - 1; j >= 0; j--) {
          const u = currentChunkUnits[j];
          if (overlapLen + u.length <= overlapCharSize) {
            overlapUnits.unshift(u);
            overlapLen += u.length;
          } else {
            break;
          }
        }

        currentChunkUnits = [...overlapUnits, unit];
        currentLength = currentChunkUnits.reduce((sum, u) => sum + u.length, 0) + (currentChunkUnits.length - 1) * 2;
      } else {
        currentChunkUnits.push(unit);
        currentLength += addedLength;
      }
    }

    if (currentChunkUnits.length > 0) {
      const finalChunk = currentChunkUnits.join('\n\n');
      if (chunks.length === 0 || chunks[chunks.length - 1] !== finalChunk) {
        chunks.push(finalChunk);
      }
    }

    return chunks.length > 0 ? chunks : [cleanText];
  }
}
