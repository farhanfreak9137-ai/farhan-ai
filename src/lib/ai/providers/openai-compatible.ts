import OpenAI from 'openai';
import {
  ChatMessage,
  ChatOptions,
  LLMProvider,
  ProviderId,
  ToolDeclaration,
  ChatCompletionResponse,
} from '../types';

export interface OpenAICompatibleConfig {
  id: ProviderId;
  name: string;
  apiKey: string;
  baseURL?: string;
  defaultModel: string;
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: ProviderId;
  readonly name: string;
  private client: OpenAI;
  private defaultModel: string;

  constructor(config: OpenAICompatibleConfig) {
    this.id = config.id;
    this.name = config.name;
    this.defaultModel = config.defaultModel;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || undefined,
    });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const model = options?.model || this.defaultModel;

    const response = await this.client.chat.completions.create({
      model,
      messages: messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  }

  async streamChat(messages: ChatMessage[], options?: ChatOptions): Promise<ReadableStream<string>> {
    const model = options?.model || this.defaultModel;

    const stream = await this.client.chat.completions.create({
      model,
      messages: messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens,
      stream: true,
    });

    return new ReadableStream<string>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(content);
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

    const formattedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.toolCallId || 'call-default',
        };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return {
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      };
    });

    const openAiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters as Record<string, unknown>,
      },
    }));

    const response = await this.client.chat.completions.create({
      model,
      messages: formattedMessages,
      tools: openAiTools.length > 0 ? openAiTools : undefined,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens,
    });

    const choice = response.choices[0]?.message;
    if (choice?.tool_calls && choice.tool_calls.length > 0) {
      return {
        content: choice.content,
        toolCalls: choice.tool_calls.map((tc: any) => {
          let args: Record<string, unknown> = {};
          const fn = tc.function || tc;
          try {
            args = JSON.parse(fn?.arguments || '{}');
          } catch (e) {
            console.error('Failed to parse tool call arguments:', fn?.arguments);
          }
          return {
            id: tc.id || `call-${Date.now()}`,
            name: fn?.name || '',
            arguments: args,
          };
        }),
      };
    }

    return {
      content: choice?.content || '',
    };
  }
}
