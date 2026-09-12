import { GoogleGenAI } from '@google/genai';
import {
  ChatMessage,
  ChatOptions,
  LLMProvider,
  ProviderId,
  ToolDeclaration,
  ChatCompletionResponse,
} from '../types';

export class GeminiProvider implements LLMProvider {
  readonly id: ProviderId = 'gemini';
  readonly name = 'Google Gemini (1M+ Token Context)';
  private keys: string[] = [];
  private currentKeyIndex = 0;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel?: string) {
    this.keys = this.parseKeys(apiKey);
    if (this.keys.length === 0) {
      throw new Error('GEMINI_API_KEY or GEMINI_API_KEYS is not configured in .env.local');
    }
    this.defaultModel = defaultModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  private parseKeys(apiKey?: string): string[] {
    const raw = apiKey || process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    return Array.from(
      new Set(
        raw
          .split(/[\n,;]+/)
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      )
    );
  }

  private getActiveClient(): { ai: GoogleGenAI; keyIndex: number; keyPreview: string } {
    const keyIndex = this.currentKeyIndex % this.keys.length;
    const key = this.keys[keyIndex];
    const keyPreview = `${key.slice(0, 8)}...${key.slice(-4)}`;
    return {
      ai: new GoogleGenAI({ apiKey: key }),
      keyIndex,
      keyPreview,
    };
  }

  private isRateLimitOrQuotaError(err: unknown): boolean {
    if (!err) return false;
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    return (
      lower.includes('429') ||
      lower.includes('resource_exhausted') ||
      lower.includes('quota') ||
      lower.includes('rate limit') ||
      lower.includes('too many requests') ||
      lower.includes('overloaded')
    );
  }

  private async executeWithRotation<T>(
    operationName: string,
    operation: (ai: GoogleGenAI) => Promise<T>
  ): Promise<T> {
    const totalKeys = this.keys.length;
    let lastError: unknown;

    for (let attempt = 0; attempt < totalKeys; attempt++) {
      const { ai, keyIndex, keyPreview } = this.getActiveClient();
      try {
        return await operation(ai);
      } catch (err: unknown) {
        lastError = err;
        const isQuota = this.isRateLimitOrQuotaError(err);
        const errMsg = err instanceof Error ? err.message : String(err);

        if (isQuota && totalKeys > 1 && attempt < totalKeys - 1) {
          console.warn(
            `[GeminiProvider] Key ${keyIndex + 1}/${totalKeys} (${keyPreview}) rate-limited or quota reached during ${operationName}. Rotating to next key...`
          );
          this.currentKeyIndex = (this.currentKeyIndex + 1) % totalKeys;
          continue;
        }

        // If not a quota error or no more keys left to try
        throw err;
      }
    }

    throw lastError;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const model = options?.model || this.defaultModel;
    const { systemInstruction, contents } = this.formatMessages(messages);

    return this.executeWithRotation('chat', async (ai) => {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemInstruction || undefined,
          temperature: options?.temperature ?? 0.2,
          maxOutputTokens: options?.maxTokens,
        },
      });

      return response.text || '';
    });
  }

  async streamChat(messages: ChatMessage[], options?: ChatOptions): Promise<ReadableStream<string>> {
    const model = options?.model || this.defaultModel;
    const { systemInstruction, contents } = this.formatMessages(messages);

    return this.executeWithRotation('streamChat', async (ai) => {
      const responseStream = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction: systemInstruction || undefined,
          temperature: options?.temperature ?? 0.2,
          maxOutputTokens: options?.maxTokens,
        },
      });

      return new ReadableStream<string>({
        async start(controller) {
          try {
            for await (const chunk of responseStream) {
              const text = chunk.text;
              if (text) {
                controller.enqueue(text);
              }
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });
    });
  }

  async chatWithTools(
    messages: ChatMessage[],
    tools: ToolDeclaration[],
    options?: ChatOptions
  ): Promise<ChatCompletionResponse> {
    const model = options?.model || this.defaultModel;
    const { systemInstruction, contents } = this.formatMessagesWithTools(messages);

    const functionDeclarations = tools.map((t) => {
      const params = t.parameters as any;
      const props = params?.properties ? { ...params.properties } : {};
      for (const [k, v] of Object.entries(props)) {
        if ((v as any)?.type === 'array' && !(v as any)?.items) {
          props[k] = { ...(v as any), items: { type: 'string' } };
        }
      }
      return {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: props,
          required: params?.required,
        } as any,
      };
    });

    return this.executeWithRotation('chatWithTools', async (ai) => {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemInstruction || undefined,
          temperature: options?.temperature ?? 0.2,
          maxOutputTokens: options?.maxTokens,
          tools: [{ functionDeclarations }],
        },
      });

      if (response.functionCalls && response.functionCalls.length > 0) {
        const rawParts = response.candidates?.[0]?.content?.parts || [];
        return {
          content: response.text || null,
          toolCalls: response.functionCalls.map((fc, idx) => ({
            id: `call-gemini-${Date.now()}-${idx}`,
            name: fc.name || '',
            arguments: (fc.args || {}) as Record<string, unknown>,
          })),
          rawModelParts: rawParts,
        };
      }

      return {
        content: response.text || '',
      };
    });
  }

  private formatMessages(messages: ChatMessage[]) {
    let systemInstruction = '';
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = systemInstruction ? `${systemInstruction}\n\n${msg.content}` : msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    return { systemInstruction, contents };
  }

  private formatMessagesWithTools(messages: ChatMessage[]) {
    let systemInstruction = '';
    const contents: Array<{ role: string; parts: Array<any> }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = systemInstruction ? `${systemInstruction}\n\n${msg.content}` : msg.content;
      } else if (msg.role === 'tool') {
        let parsedResult: any = msg.content;
        try {
          parsedResult = JSON.parse(msg.content);
        } catch {}

        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: msg.name || 'tool',
                response: { output: parsedResult },
              },
            },
          ],
        });
      } else if (msg.role === 'assistant') {
        if (msg.rawModelParts && msg.rawModelParts.length > 0) {
          contents.push({
            role: 'model',
            parts: msg.rawModelParts,
          });
        } else if (msg.toolCalls && msg.toolCalls.length > 0) {
          contents.push({
            role: 'model',
            parts: msg.toolCalls.map((tc) => ({
              functionCall: {
                name: tc.name,
                args: tc.arguments,
              },
            })),
          });
        } else {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content || '' }],
          });
        }
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    return { systemInstruction, contents };
  }
}
