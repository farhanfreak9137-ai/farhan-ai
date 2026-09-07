import { DocumentExtractor, ExtractedContent } from './base';

export class JsonExtractor implements DocumentExtractor {
  canExtract(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ext === 'json';
  }

  async extract(input: Buffer | string, filename: string): Promise<ExtractedContent> {
    const raw = typeof input === 'string' ? input : input.toString('utf-8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON';
      throw new Error(`JSON extraction failed for '${filename}': ${msg}`);
    }

    if (parsed === null || parsed === undefined) {
      throw new Error(`JSON extraction failed: '${filename}' contains empty/null value.`);
    }

    // Format into natural structured text
    const text = this.formatJsonValue(parsed, 0);

    const topLevelKeys = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? Object.keys(parsed)
      : [];

    return {
      text,
      metadata: {
        isJson: true,
        rootType: Array.isArray(parsed) ? 'array' : typeof parsed,
        topLevelKeys: topLevelKeys.slice(0, 15),
      },
      detectedType: 'json',
    };
  }

  private formatJsonValue(val: unknown, depth: number): string {
    const indent = '  '.repeat(depth);
    if (val === null || val === undefined) return `${indent}null`;

    if (typeof val === 'string') return `${indent}"${val}"`;
    if (typeof val === 'number' || typeof val === 'boolean') return `${indent}${val}`;

    if (Array.isArray(val)) {
      if (val.length === 0) return `${indent}[]`;
      const lines: string[] = [`${indent}[`];
      for (const item of val) {
        if (typeof item === 'object' && item !== null) {
          lines.push(this.formatJsonValue(item, depth + 1));
        } else {
          lines.push(`${indent}  • ${item}`);
        }
      }
      lines.push(`${indent}]`);
      return lines.join('\n');
    }

    if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) return `${indent}{}`;

      const lines: string[] = [];
      for (const k of keys) {
        const v = obj[k];
        if (typeof v === 'object' && v !== null) {
          lines.push(`${indent}${k}:`);
          lines.push(this.formatJsonValue(v, depth + 1));
        } else {
          lines.push(`${indent}${k}: ${v}`);
        }
      }
      return lines.join('\n');
    }

    return `${indent}${String(val)}`;
  }
}
