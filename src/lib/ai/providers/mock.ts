import {
  ChatMessage,
  ChatOptions,
  LLMProvider,
  ProviderId,
  ToolDeclaration,
  ChatCompletionResponse,
  ToolCall,
} from '../types';

export class MockProvider implements LLMProvider {
  readonly id: ProviderId = 'mock';
  readonly name = 'Mock Offline Provider';

  private toolCallQueue: ToolCall[] = [];
  private customResponse: string | null = null;

  constructor(initialToolCalls?: ToolCall[]) {
    if (initialToolCalls && initialToolCalls.length > 0) {
      this.toolCallQueue = [...initialToolCalls];
    }
  }

  /**
   * Queues a deterministic tool call for test execution.
   */
  public queueToolCall(callOrName: ToolCall | string, maybeArgs?: Record<string, any>, _maybeContent?: string): void {
    if (typeof callOrName === 'string') {
      this.toolCallQueue.push({
        id: `call_${Date.now()}`,
        name: callOrName,
        arguments: maybeArgs || {},
      });
    } else {
      this.toolCallQueue.push(callOrName);
    }
  }

  public queueToolCalls(calls: ToolCall[]): void {
    this.toolCallQueue.push(...calls);
  }

  public setCustomResponse(response: string): void {
    this.customResponse = response;
  }

  public clearQueue(): void {
    this.toolCallQueue = [];
    this.customResponse = null;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (this.customResponse) {
      const res = this.customResponse;
      this.customResponse = null;
      return res;
    }
    return this.generateResponse(messages);
  }

  async streamChat(messages: ChatMessage[], options?: ChatOptions): Promise<ReadableStream<string>> {
    const fullText = await this.chat(messages, options);
    const words = fullText.split(' ');

    return new ReadableStream<string>({
      async start(controller) {
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? '' : ' ') + words[i];
          controller.enqueue(chunk);
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
        controller.close();
      },
    });
  }

  /**
   * Native function calling using deterministic fixture queue for automated tests.
   * Does NOT use regex or keyword matching.
   */
  async chatWithTools(
    messages: ChatMessage[],
    tools: ToolDeclaration[],
    options?: ChatOptions
  ): Promise<ChatCompletionResponse> {
    // 1. If fixture tool calls are queued, return the next queued tool call
    if (this.toolCallQueue.length > 0) {
      const nextCall = this.toolCallQueue.shift()!;
      return {
        content: null,
        toolCalls: [nextCall],
      };
    }

    // 2. If tools have returned data in conversation history, synthesize tool output
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'tool') {
      try {
        const parsed = JSON.parse(lastMessage.content);
        return {
          content: `I have completed executing the requested task. Here is the synthesized result:\n\n${JSON.stringify(parsed, null, 2)}`,
        };
      } catch {
        return {
          content: `Task execution completed: ${lastMessage.content}`,
        };
      }
    }

    // 3. Conversational direct answer
    const directResponse = await this.chat(messages, options);
    return {
      content: directResponse,
    };
  }

  private generateResponse(messages: ChatMessage[]): string {
    const userMessage = messages
      .filter((m) => m.role === 'user')
      .pop()
      ?.content.toLowerCase() || '';

    if (userMessage.includes('nasa') || userMessage.includes('pilot') || userMessage.includes('blockchain 2012')) {
      return "I do not have any record of Farhan having this experience in my verified career database. Farhan's background is focused on AI Software Engineering, TypeScript/Next.js architectures, and full-stack systems.";
    }

    if (userMessage.includes('skill') || userMessage.includes('stack') || userMessage.includes('technolog')) {
      return "Farhan's core skills are organized into four verified domains:\n\n" +
        "1. **Languages & Core**: TypeScript (Advanced), JavaScript ESNext (Expert), Python (Advanced), SQL, and Modern CSS.\n" +
        "2. **AI & Agentic Systems**: LLM Orchestration, Function & Tool Calling, Production RAG Pipelines, and Multi-Model Routing.\n" +
        "3. **Frameworks & Web**: Next.js App Router, React, Node.js, and Streaming REST APIs.\n" +
        "4. **Databases & Infrastructure**: PostgreSQL, Redis, Docker, and GitHub Actions CI/CD.\n\n" +
        "Is there a specific technical competency or role alignment you would like me to evaluate?";
    }

    if (userMessage.includes('project') || userMessage.includes('portfolio')) {
      return "Farhan's featured projects include:\n\n" +
        "1. **Farhan AI (Personal Career Operating System)**: An agentic platform built with Next.js App Router, TypeScript, and multi-provider LLM failover with strict anti-hallucination grounding.\n" +
        "2. **Autonomous Workflow Engine**: An event-driven task automation framework featuring dynamic tool calling and schema validation.\n\n" +
        "Would you like me to walk you through the architectural decisions behind either project?";
    }

    if (userMessage.includes('goal') || userMessage.includes('preference') || userMessage.includes('role')) {
      return "Farhan's primary career targets are **AI Software Engineer**, **Senior Full-Stack Engineer**, and **AI Systems Architect**.\n\n" +
        "- **Work Model**: Remote (Worldwide or flexible timezones)\n" +
        "- **Short-Term Goal**: Master agentic tool calling, autonomous workflows, and production RAG pipelines.\n" +
        "- **Long-Term Goal**: Lead AI architecture for autonomous software developer agents.\n" +
        "- **Core Values**: Technical Craftsmanship, Extreme Ownership, Continuous Learning, and High Practical Impact.";
    }

    return "Hello! I am **Farhan AI**, your personal career agent. I am grounded strictly in Farhan's verified skills, experience, projects, and career goals. How can I assist you with career analysis, skill-gap evaluation, or interview preparation today?";
  }
}
