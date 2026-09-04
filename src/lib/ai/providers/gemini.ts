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
  private ai: GoogleGenAI;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY || '';
    if (!key) {
      throw new Error('GEMINI_API_KEY is not configured in .env.local');
    }
    this.ai = new GoogleGenAI({ apiKey: key });
    this.defaultModel = defaultModel || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const model = options?.model || this.defaultModel;
    const { systemInstruction, contents } = this.formatMessages(messages);

    const response = await this.ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemInstruction || undefined,
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens,
      },
    });

    return response.text || '';
  }

  async streamChat(messages: ChatMessage[], options?: ChatOptions): Promise<ReadableStream<string>> {
    const model = options?.model || this.defaultModel;
    const { systemInstruction, contents } = this.formatMessages(messages);

    const responseStream = await this.ai.models.generateContentStream({
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

    const response = await this.ai.models.generateContent({
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
