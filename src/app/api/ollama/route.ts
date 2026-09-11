import { NextRequest, NextResponse } from 'next/server';
import {
  checkOllamaHealth,
  listInstalledOllamaModels,
  pullOllamaModel,
  RECOMMENDED_MODELS,
} from '@/lib/ai/ollama';

export const runtime = 'nodejs';

/**
 * GET /api/ollama
 * Returns real-time health, version, installed models, and hardware-tailored recommendations.
 */
export async function GET() {
  try {
    const health = await checkOllamaHealth(2000);
    const installed = health.running ? await listInstalledOllamaModels(2500) : [];

    return NextResponse.json({
      running: health.running,
      version: health.version,
      error: health.error,
      installedModels: installed,
      recommendedModels: RECOMMENDED_MODELS,
      hardwareProfile: {
        cpu: 'Intel Core i3 (2C/4T)',
        recommendedRamBudget: '1.0 GB - 2.5 GB',
        targetModels: ['qwen2.5:1.5b', 'llama3.2:3b', 'deepseek-r1:1.5b'],
        note: 'Optimized for 8GB RAM systems. 1.5B to 3B models offer peak responsiveness and zero memory pressure.',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to query Ollama status';
    return NextResponse.json({ error: message, running: false }, { status: 500 });
  }
}

/**
 * POST /api/ollama
 * Triggers model pulls or management actions.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, model } = body as { action?: string; model?: string };

    if (action === 'pull') {
      if (!model || typeof model !== 'string') {
        return NextResponse.json({ error: 'Model name is required for pull' }, { status: 400 });
      }

      const stream = await pullOllamaModel(model);
      return new Response(stream as any, {
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Cache-Control': 'no-cache',
        },
      });
    }

    if (action === 'check') {
      const health = await checkOllamaHealth(1500);
      return NextResponse.json(health);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ollama operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
