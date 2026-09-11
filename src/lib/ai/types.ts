export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
  toolCallId?: string;
  name?: string;
  toolCalls?: ToolCall[];
  rawModelParts?: any[];
}

export interface ToolParameterProperty {
  type: string;
  description: string;
  enum?: string[];
  items?: {
    type: string;
    description?: string;
  };
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterProperty>;
    required?: string[];
  };
}

export interface ChatCompletionResponse {
  content: string | null;
  toolCalls?: ToolCall[];
  rawModelParts?: any[];
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  stream?: boolean;
}

export type ProviderId = 'gemini' | 'openai' | 'groq' | 'ollama' | 'mock' | 'local_fastpath';

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  defaultModel: string;
  contextWindow: string; // e.g. "1,000,000+ tokens"
  configured: boolean;
  installedModels?: string[];
}

export interface LLMProvider {
  readonly id: ProviderId;
  readonly name: string;
  
  /**
   * Generates a single complete response string.
   */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;

  /**
   * Streams response chunks as they arrive from the provider.
   */
  streamChat(messages: ChatMessage[], options?: ChatOptions): Promise<ReadableStream<string>>;

  /**
   * Generates a response with native function/tool calling support.
   */
  chatWithTools?(
    messages: ChatMessage[],
    tools: ToolDeclaration[],
    options?: ChatOptions
  ): Promise<ChatCompletionResponse>;
}
