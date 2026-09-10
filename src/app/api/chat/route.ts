import { NextRequest } from 'next/server';
import { ChatMessage, ProviderId } from '@/lib/ai/types';
import { streamChatWithFallback } from '@/lib/ai/factory';
import { prepareChatPayloadAsync } from '@/lib/ai/prompts';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, provider } = body as {
      messages: ChatMessage[];
      provider?: ProviderId;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Prepare strictly grounded messages with injected candidate profile from SQLite
    const payload = await prepareChatPayloadAsync(messages);

    // Stream response with multi-API automatic failover
    const { stream, providerUsed } = await streamChatWithFallback(payload, {}, provider);

    // Encode text stream to Uint8Array for HTTP streaming response
    const encoder = new TextEncoder();
    const transformStream = new TransformStream<string, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(encoder.encode(chunk));
      },
    });

    const responseStream = stream.pipeThrough(transformStream);

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'x-provider-used': providerUsed,
      },
    });
  } catch (error: unknown) {
    console.error('Chat API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
