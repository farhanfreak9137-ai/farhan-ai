import { NextRequest, NextResponse } from 'next/server';
import { runOrchestrator } from '@/lib/ai/orchestrator';
import { ChatMessage, ProviderId, ToolCall } from '@/lib/ai/types';
import { z } from 'zod';
import { defaultRegistry } from '@/lib/agents/registry';

export const runtime = 'nodejs';

// Strict input schema for orchestrator request
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(50000, 'Message content exceeds maximum allowed length'),
});

const ToolCallSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(128),
  arguments: z.record(z.string(), z.unknown()),
});

const OrchestrateRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1, 'At least one message is required').max(100),
  provider: z.enum(['gemini', 'openai', 'groq', 'mock']).optional(),
  action: z.enum(['approve_action', 'execute']).optional(),
  toolCall: ToolCallSchema.optional(),
});

export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const parseResult = OrchestrateRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.issues.map((e) => ({
            path: e.path.map(String).join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const { messages, provider, action, toolCall } = parseResult.data;

    const isHumanApproved = action === 'approve_action';
    let validatedApprovedToolCall: ToolCall | undefined;

    if (isHumanApproved) {
      if (!toolCall) {
        return NextResponse.json(
          { error: 'toolCall is required when action is approve_action' },
          { status: 400 }
        );
      }

      // Verify that the approved tool exists in the registry to prevent arbitrary execution
      const tool = defaultRegistry.getTool(toolCall.name);
      if (!tool) {
        return NextResponse.json(
          { error: `Unauthorized tool approval: '${toolCall.name}' is not a registered tool.` },
          { status: 403 }
        );
      }

      validatedApprovedToolCall = {
        id: toolCall.id,
        name: toolCall.name,
        arguments: toolCall.arguments,
      };
    }

    const result = await runOrchestrator(messages as ChatMessage[], provider as ProviderId | undefined, {
      isHumanApproved,
      approvedToolCall: validatedApprovedToolCall,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Orchestrator API error:', err);
    const msg = err instanceof Error ? err.message : 'Orchestration failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
