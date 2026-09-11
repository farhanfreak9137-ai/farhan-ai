// tests/voice/verify-voice.test.ts
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { db, ensureDatabaseReady } from '../../src/lib/db';
import { computerActions, automationApprovals, workflows } from '../../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { mockVoiceProvider } from '../../src/lib/voice/mockVoiceProvider';
import { ServerVoiceProvider } from '../../src/lib/voice/serverVoiceProvider';
import {
  getVoiceProvider,
  setVoiceProvider,
  resetVoiceProvider,
  getVoiceProviderStatus,
} from '../../src/lib/voice/factory';
import { processVoiceCommand } from '../../src/lib/voice/voiceAssistant';

describe('Objective 7: Voice Architecture & Security', () => {
  before(async () => {
    await ensureDatabaseReady();
    // Use mock provider for deterministic offline testing
    setVoiceProvider(mockVoiceProvider);
  });

  after(() => {
    resetVoiceProvider();
  });

  test('1. Provider Abstraction: Mock and Server providers implement typed interface', async () => {
    assert.strictEqual(mockVoiceProvider.getState(), 'MOCK');
    assert.strictEqual(mockVoiceProvider.id, 'mock_voice_provider');

    const serverProvider = new ServerVoiceProvider();
    assert.ok(serverProvider.name);
    // When no API key is set, server provider reports MOCK mode
    assert.strictEqual(serverProvider.getState(), 'MOCK');

    const status = getVoiceProviderStatus();
    assert.strictEqual(status.hasSTT, true);
    assert.strictEqual(status.hasTTS, true);
    assert.ok(status.name);
  });

  test('2. Mock STT: Transcribes audio stream/buffer with metadata and timestamp', async () => {
    mockVoiceProvider.queueTranscript('Show me senior remote AI engineering roles');

    const result = await mockVoiceProvider.transcribe({
      audio: 'data:audio/wav;base64,UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
      language: 'en',
    });

    assert.strictEqual(result.transcript, 'Show me senior remote AI engineering roles');
    assert.strictEqual(result.provider, 'mock_voice');
    assert.strictEqual(result.confidence, 0.98);
    assert.ok(result.timestamp);
  });

  test('3. Mock TTS: Synthesizes valid WAV PCM audio container with duration estimate', async () => {
    const text = 'Farhan AI has matched 3 new opportunities for your verified profile.';
    const result = await mockVoiceProvider.speak({ text, language: 'en' });

    assert.ok(result.audioData.length > 0);
    assert.strictEqual(result.format, 'wav');
    assert.ok(result.duration && result.duration > 0);
    assert.strictEqual(result.provider, 'mock_voice');

    // Verify WAV RIFF header in synthesized audio
    const buffer = Buffer.from(result.audioData, 'base64');
    assert.strictEqual(buffer.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.strictEqual(buffer.subarray(8, 12).toString('ascii'), 'WAVE');
  });

  test('4. Transcript validation: Rejects empty or missing speech input safely', async () => {
    await assert.rejects(
      async () => {
        await processVoiceCommand({});
      },
      { message: /No speech transcript or audio provided/ }
    );
  });

  test('5. Central Assistant Integration: Spoken queries execute via Central Assistant without second architecture', async () => {
    const response = await processVoiceCommand({
      transcript: 'What is Farhan known for?',
    });

    assert.ok(response.transcript);
    assert.ok(response.responseText);
    assert.ok(response.responseAudio, 'Spoken answer must include synthesized audio');
    assert.strictEqual(response.audioFormat, 'wav');
    assert.ok(response.responseText.length > 0);
  });

  test('6. Voice cannot bypass policy: Mutating tool requests require human approval', async () => {
    const { MockProvider } = await import('../../src/lib/ai/providers/mock');
    const mockProvider = new MockProvider();
    mockProvider.queueToolCall('create_application', {
      company: 'Nexus Cognitive Lab',
      role: 'Senior AI Systems Engineer',
      location: 'Remote',
      workModel: 'remote',
    });

    const response = await processVoiceCommand({
      transcript: 'Create an application for Nexus Cognitive Lab for the Senior AI Systems Engineer role',
      provider: mockProvider,
    });

    assert.ok(response.responseText);
    // Approval required flag must be preserved
    assert.strictEqual(response.approvalRequired, true);
    assert.ok(response.approvalDetails);
    assert.ok(response.responseAudio);
  });

  test('7. Voice Safety: "Approve" with ZERO pending actions returns clear notification', async () => {
    // Clean any residual pending actions for clean test state
    await db.delete(computerActions).where(eq(computerActions.status, 'PENDING_APPROVAL'));
    await db.delete(automationApprovals).where(eq(automationApprovals.status, 'PENDING'));

    const response = await processVoiceCommand({
      transcript: 'Approve',
    });

    assert.strictEqual(response.responseText, 'There are no pending actions waiting for approval.');
    assert.strictEqual(response.approvalRequired, undefined);
  });

  test('8. Voice Safety: "Approve" with MULTIPLE pending actions strictly rejects with explicit message and does NOT approve anything', async () => {
    // Create 2 pending actions in computer_actions
    const action1Id = uuidv4();
    const action2Id = uuidv4();

    await db.insert(computerActions).values([
      {
        id: action1Id,
        sessionId: 'test-session-1',
        action: 'click',
        payload: { selector: '#btn-submit-1' },
        status: 'PENDING_APPROVAL',
        createdAt: new Date().toISOString(),
      },
      {
        id: action2Id,
        sessionId: 'test-session-2',
        action: 'click',
        payload: { selector: '#btn-submit-2' },
        status: 'PENDING_APPROVAL',
        createdAt: new Date().toISOString(),
      },
    ]);

    const response = await processVoiceCommand({
      transcript: 'Approve',
    });

    // Must NOT guess! Must reject with exact required phrase
    assert.strictEqual(response.responseText, 'Multiple pending approvals require explicit selection.');
    assert.strictEqual(response.approvalRequired, true);

    // Verify NEITHER action was approved in SQLite
    const check1 = await db.select().from(computerActions).where(eq(computerActions.id, action1Id));
    const check2 = await db.select().from(computerActions).where(eq(computerActions.id, action2Id));
    assert.strictEqual(check1[0].status, 'PENDING_APPROVAL');
    assert.strictEqual(check2[0].status, 'PENDING_APPROVAL');

    // Clean up test records
    await db.delete(computerActions).where(eq(computerActions.id, action1Id));
    await db.delete(computerActions).where(eq(computerActions.id, action2Id));
  });

  test('9. Voice Safety: "Yes, do it" binds and approves when EXACTLY ONE eligible pending approval exists', async () => {
    // Clean up pending actions first
    await db.delete(computerActions).where(eq(computerActions.status, 'PENDING_APPROVAL'));
    await db.delete(automationApprovals).where(eq(automationApprovals.status, 'PENDING'));

    const singleActionId = uuidv4();
    await db.insert(automationApprovals).values({
      id: singleActionId,
      jobId: 'job-test-123',
      runId: 'run-test-123',
      actionType: 'EXTERNAL_SUBMIT',
      reason: 'Submit application to DeepMind',
      requestedAction: { company: 'DeepMind', role: 'Staff AI Engineer' },
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    });

    const response = await processVoiceCommand({
      transcript: 'Yes, do it',
    });

    assert.ok(response.responseText.includes('Approved pending automation action'));
    assert.ok(response.responseText.includes('Submit application to DeepMind'));

    // Verify approval persisted in SQLite
    const updated = await db.select().from(automationApprovals).where(eq(automationApprovals.id, singleActionId));
    assert.strictEqual(updated[0].status, 'APPROVED');

    // Clean up
    await db.delete(automationApprovals).where(eq(automationApprovals.id, singleActionId));
  });

  test('10. Voice Safety: Provider status never leaks server API secrets to the caller', async () => {
    const status = getVoiceProviderStatus();
    const statusJson = JSON.stringify(status);

    assert.ok(!statusJson.includes('sk-'));
    assert.ok(!statusJson.includes('secret'));
    assert.ok(!statusJson.includes('apiKey'));
    assert.ok(status.state === 'REAL' || status.state === 'MOCK');
  });
});
