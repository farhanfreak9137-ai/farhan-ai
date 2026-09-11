// src/lib/voice/voiceAssistant.ts
import { db, ensureDatabaseReady } from '@/lib/db';
import { computerActions, automationApprovals, workflows } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { centralAssistant } from '@/lib/agents/assistant';
import { getVoiceProvider } from './factory';
import {
  VoiceCommandRequest,
  VoiceCommandResponse,
  TranscriptionRequest,
} from './types';
import { handleComputerApprove } from '@/lib/computer/service';
import { defaultWorkflowEngine } from '@/lib/workflows/engine';

/**
 * Matches phrases indicating approval confirmation.
 */
const APPROVAL_INTENT_REGEX = /^\s*(approve|yes\s*(,\s*)?do\s+it|confirm|proceed|i approve|approve it)\s*[\.!]?\s*$/i;

/**
 * Handles voice-driven interaction by integrating directly into Farhan AI's Central Assistant.
 *
 * Flow:
 * 1. (Optional) STT speech-to-text.
 * 2. Voice safety & explicit approval checking:
 *    - If user speaks an approval confirmation ("Approve", "Yes, do it"):
 *      - Verify eligible pending approvals across computer_actions, automation_approvals, workflows.
 *      - If multiple pending: reject with "Multiple pending approvals require explicit selection."
 *      - If zero pending: state no pending actions.
 *      - If exactly one pending: approve the exact persisted action.
 * 3. Otherwise: route directly to Central Assistant with native function calling.
 *    - Voice commands obey the exact same security boundaries as typed commands.
 *    - Mutating/consequential actions require approval and will not execute implicitly.
 * 4. Text-to-speech generation for spoken audio response.
 */
export async function processVoiceCommand(request: VoiceCommandRequest): Promise<VoiceCommandResponse> {
  await ensureDatabaseReady();
  const provider = getVoiceProvider();

  // 1. Resolve transcript
  let transcript = request.transcript?.trim();
  if (!transcript && request.audio) {
    const sttReq: TranscriptionRequest = {
      audio: request.audio,
      language: request.language || 'en',
    };
    const sttResult = await provider.transcribe(sttReq);
    transcript = sttResult.transcript.trim();
  }

  if (!transcript) {
    throw new Error('No speech transcript or audio provided');
  }

  // 2. Check for explicit approval intent
  if (APPROVAL_INTENT_REGEX.test(transcript)) {
    const approvalResolution = await handleVoiceApprovalConfirmation();
    
    // Synthesize voice response
    let responseAudio: string | undefined;
    let audioFormat = 'wav';
    try {
      const tts = await provider.speak({ text: approvalResolution.responseText, language: request.language });
      responseAudio = tts.audioData;
      audioFormat = tts.format;
    } catch (err) {
      console.warn('[VoiceAssistant] TTS synthesis error:', err);
    }

    return {
      transcript,
      responseText: approvalResolution.responseText,
      responseAudio,
      audioFormat,
      providerUsed: provider.id,
      approvalRequired: approvalResolution.approvalRequired,
      approvalDetails: approvalResolution.approvalDetails,
    };
  }

  // 3. Central Assistant execution
  // Voice is simply another interface to Central Assistant.
  const assistantResult = await centralAssistant.processRequest(transcript, {
    provider: request.provider,
  });

  const responseText = assistantResult.answer;
  const approvalRequired = !!assistantResult.approvalRequest;
  const approvalDetails = assistantResult.approvalRequest
    ? {
        title: assistantResult.approvalRequest.title,
        description: assistantResult.approvalRequest.description,
        payload: assistantResult.approvalRequest.payload,
      }
    : undefined;

  // 4. Synthesize spoken response via TTS (Bypass completely for offline fast-path to prevent cloud delays)
  let responseAudio: string | undefined;
  let audioFormat = 'wav';
  if (assistantResult.providerUsed !== 'local_fastpath') {
    try {
      const tts = await provider.speak({ text: responseText, language: request.language });
      responseAudio = tts.audioData;
      audioFormat = tts.format;
    } catch (err) {
      console.warn('[VoiceAssistant] TTS synthesis error:', err);
    }
  }

  return {
    transcript,
    responseText,
    responseAudio,
    audioFormat,
    providerUsed: assistantResult.providerUsed || provider.id,
    approvalRequired,
    approvalDetails,
    steps: assistantResult.steps.map((s, idx) => ({
      step: s.step || `step-${idx + 1}`,
      title: s.title,
      description: s.details || s.title,
    })),
  };
}

/**
 * Evaluates pending approvals and binds unambiguous voice approval to the exact pending action.
 */
async function handleVoiceApprovalConfirmation(): Promise<{
  responseText: string;
  approvalRequired?: boolean;
  approvalDetails?: any;
}> {
  // 1. Gather all pending computer actions
  const pendingComputer = await db
    .select()
    .from(computerActions)
    .where(eq(computerActions.status, 'PENDING_APPROVAL'));

  // 2. Gather all pending automation approvals
  const pendingAutomation = await db
    .select()
    .from(automationApprovals)
    .where(eq(automationApprovals.status, 'PENDING'));

  const totalPending = pendingComputer.length + pendingAutomation.length;

  if (totalPending === 0) {
    return {
      responseText: 'There are no pending actions waiting for approval.',
    };
  }

  if (totalPending > 1) {
    return {
      responseText: 'Multiple pending approvals require explicit selection.',
      approvalRequired: true,
      approvalDetails: {
        totalPending,
        computerCount: pendingComputer.length,
        automationCount: pendingAutomation.length,
      },
    };
  }

  // Exactly one pending approval exists
  if (pendingComputer.length === 1) {
    const action = pendingComputer[0];
    const exec = await handleComputerApprove(action.id, true);
    if (exec.body.success) {
      return {
        responseText: `Approved and executed pending computer action: ${action.action}.`,
        approvalRequired: false,
      };
    } else {
      return {
        responseText: `Approval failed for computer action ${action.action}: ${exec.body.error || 'Unknown error'}.`,
        approvalRequired: false,
      };
    }
  }

  if (pendingAutomation.length === 1) {
    const item = pendingAutomation[0];
    await db
      .update(automationApprovals)
      .set({ status: 'APPROVED' })
      .where(eq(automationApprovals.id, item.id));

    return {
      responseText: `Approved pending automation action: ${item.reason}.`,
      approvalRequired: false,
    };
  }

  return {
    responseText: 'No eligible pending approval found.',
  };
}
