// src/app/api/voice/history/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

/**
 * GET /api/voice/history
 * Returns timestamped history of all voice commands and Auren's answers.
 */
export async function GET() {
  try {
    const historyFile = path.resolve(process.cwd(), 'data/voice_command_history.txt');
    const logFile = path.resolve(process.cwd(), 'data/voice_assistant.log');

    let historyText = '';
    if (fs.existsSync(historyFile)) {
      historyText = fs.readFileSync(historyFile, 'utf8');
    }

    // Also extract recent Whisper transcribes from the raw log if history is empty
    const recentLogs: string[] = [];
    if (fs.existsSync(logFile)) {
      const raw = fs.readFileSync(logFile, 'utf8');
      const lines = raw.split(/\r?\n/).slice(-100);
      for (const line of lines) {
        if (
          line.includes('Groq Whisper') ||
          line.includes('Wake word detected') ||
          line.includes('Auren:') ||
          line.includes('Routing command') ||
          line.includes('Executing one-shot')
        ) {
          recentLogs.push(line.trim());
        }
      }
    }

    return NextResponse.json({
      historyText,
      recentEvents: recentLogs.slice(-30),
      rawLogPath: logFile,
      historyFilePath: historyFile
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to read voice history' },
      { status: 500 }
    );
  }
}
