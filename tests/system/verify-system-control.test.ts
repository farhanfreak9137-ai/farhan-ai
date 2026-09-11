import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { defaultRegistry } from '../../src/lib/agents/registry';
import { SystemAgent, resolveSystemPath, isMutatingOrDangerousCommand } from '../../src/lib/agents/system-agent';
import { buildSystemPrompt } from '../../src/lib/ai/prompts';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

import { tryFastPathRoute, runPcController } from '../../src/lib/agents/fastPathRouter';
import { CentralAssistant } from '../../src/lib/agents/assistant';

describe('System & OS Control Agent Verification', () => {
  const tempTestDir = path.join(os.tmpdir(), `farhan_sys_test_${Date.now()}`);

  before(async () => {
    await fs.mkdir(tempTestDir, { recursive: true });
  });

  after(async () => {
    try {
      await fs.rm(tempTestDir, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  test('1. SystemAgent is registered in defaultRegistry with all 8 tools', () => {
    const agent = defaultRegistry.getAgent('system_agent');
    assert.ok(agent, 'SystemAgent must be registered');
    assert.strictEqual(agent.id, 'system_agent');

    const tools = [
      'execute_command',
      'file_operations',
      'launch_application',
      'system_diagnostics',
      'pc_window_control',
      'audio_media_control',
      'process_management',
      'screen_capture',
    ];
    for (const toolName of tools) {
      const tool = defaultRegistry.getTool(toolName);
      assert.ok(tool, `Tool ${toolName} must be registered in defaultRegistry`);
      assert.strictEqual(tool.agentId, 'system_agent');
    }
  });

  test('2. Path resolver expands Windows shortcuts accurately', () => {
    const downloads = resolveSystemPath('%DOWNLOADS%');
    assert.strictEqual(downloads.includes('Downloads'), true);

    const documents = resolveSystemPath('%DOCUMENTS%');
    assert.strictEqual(documents.includes('Documents'), true);

    const desktop = resolveSystemPath('%DESKTOP%');
    assert.strictEqual(desktop.includes('Desktop'), true);

    const userProfile = resolveSystemPath('%USERPROFILE%');
    assert.strictEqual(userProfile, os.homedir());
  });

  test('3. Dangerous command classifier identifies mutating operations', () => {
    assert.strictEqual(isMutatingOrDangerousCommand('winget install --id Google.Chrome'), true);
    assert.strictEqual(isMutatingOrDangerousCommand('npm install express'), true);
    assert.strictEqual(isMutatingOrDangerousCommand('pip install torch'), true);
    assert.strictEqual(isMutatingOrDangerousCommand('del /f /s *.*'), true);
    assert.strictEqual(isMutatingOrDangerousCommand('rmdir /s myfolder'), true);
    assert.strictEqual(isMutatingOrDangerousCommand('dir'), false);
    assert.strictEqual(isMutatingOrDangerousCommand('ipconfig'), false);
    assert.strictEqual(isMutatingOrDangerousCommand('git status'), false);
  });

  test('4. system_diagnostics returns real hardware and OS metrics', async () => {
    const tool = defaultRegistry.getTool('system_diagnostics');
    assert.ok(tool);

    const result = await tool.execute({}, {});
    assert.strictEqual(result.success, true);
    const data = result.data as any;

    assert.ok(data.os.platform);
    assert.ok(data.os.username);
    assert.ok(data.cpu.model);
    assert.ok(data.cpu.cores > 0);
    assert.ok(data.memory.totalGb);
    assert.ok(data.memory.usagePercent);
    assert.ok(Array.isArray(data.diskDrives));
  });

  test('5. execute_command enforces human approval boundary when unapproved', async () => {
    const result = await defaultRegistry.executeTool(
      'execute_command',
      { command: 'echo "hello farhan"' },
      { isHumanApproved: false }
    );

    assert.strictEqual(result.requiresHumanApproval, true);
    assert.ok(result.approvalPayload);
    assert.strictEqual(result.approvalPayload?.actionType, 'system_command');
  });

  test('6. execute_command runs command successfully when approved', async () => {
    const result = await defaultRegistry.executeTool(
      'execute_command',
      { command: 'echo "hello farhan"' },
      { isHumanApproved: true }
    );

    assert.strictEqual(result.success, true);
    const data = result.data as any;
    assert.ok(data.stdout.includes('hello farhan'));
    assert.strictEqual(data.exitCode, 0);
  });

  test('7. file_operations: create directory, copy file, preview, and move', async () => {
    const tool = defaultRegistry.getTool('file_operations');
    assert.ok(tool);

    // Create a test file
    const testFile1 = path.join(tempTestDir, 'test_source.txt');
    await fs.writeFile(testFile1, 'Farhan AI OS Control Test Content');

    // Copy file
    const testFile2 = path.join(tempTestDir, 'test_copy.txt');
    const copyResult = await defaultRegistry.executeTool(
      'file_operations',
      {
        action: 'copy_file',
        sourcePath: testFile1,
        destinationPath: testFile2,
      },
      { isHumanApproved: true }
    );
    assert.strictEqual(copyResult.success, true);

    // Preview copied file
    const previewResult = await defaultRegistry.executeTool(
      'file_operations',
      {
        action: 'read_file_preview',
        sourcePath: testFile2,
      },
      { isHumanApproved: true }
    );
    assert.strictEqual(previewResult.success, true);
    assert.ok((previewResult.data as any).preview.includes('Farhan AI OS Control Test Content'));

    // Move file
    const testFile3 = path.join(tempTestDir, 'test_moved.txt');
    const moveResult = await defaultRegistry.executeTool(
      'file_operations',
      {
        action: 'move_file',
        sourcePath: testFile2,
        destinationPath: testFile3,
      },
      { isHumanApproved: true }
    );
    assert.strictEqual(moveResult.success, true);

    // List directory
    const listResult = await defaultRegistry.executeTool(
      'file_operations',
      {
        action: 'list_directory',
        sourcePath: tempTestDir,
      },
      { isHumanApproved: true }
    );
    assert.strictEqual(listResult.success, true);
    const items = (listResult.data as any).items;
    const names = items.map((i: any) => i.name);
    assert.ok(names.includes('test_source.txt'));
    assert.ok(names.includes('test_moved.txt'));
  });

  test('8. file_operations: delete_file requires human approval', async () => {
    const testFile = path.join(tempTestDir, 'to_delete.txt');
    await fs.writeFile(testFile, 'temporary');

    const unapproved = await defaultRegistry.executeTool(
      'file_operations',
      {
        action: 'delete_file',
        sourcePath: testFile,
      },
      { isHumanApproved: false }
    );

    assert.strictEqual(unapproved.requiresHumanApproval, true);

    const approved = await defaultRegistry.executeTool(
      'file_operations',
      {
        action: 'delete_file',
        sourcePath: testFile,
      },
      { isHumanApproved: true }
    );

    assert.strictEqual(approved.success, true);
    assert.strictEqual((approved.data as any).status, 'DELETED');
  });

  test('9. file_operations: forbids deleting Windows system root', async () => {
    const result = await defaultRegistry.executeTool(
      'file_operations',
      {
        action: 'delete_file',
        sourcePath: 'C:\\Windows',
      },
      { isHumanApproved: true }
    );

    assert.strictEqual(result.success, false);
    assert.ok(result.error?.includes('Safety violation'));
  });

  test('10. launch_application formats launch command and returns success', async () => {
    const tool = defaultRegistry.getTool('launch_application');
    assert.ok(tool);

    const result = await tool.execute({ target: 'cmd', args: ['/c', 'exit 0'] }, {});
    assert.strictEqual(result.success, true);
    assert.strictEqual((result.data as any).status, 'LAUNCHED');
  });


  test('11. Central Assistant system prompt contains system agent instructions and routing rule', () => {
    const prompt = buildSystemPrompt();
    assert.ok(prompt.includes('execute_command'));
    assert.ok(prompt.includes('file_operations'));
    assert.ok(prompt.includes('launch_application'));
    assert.ok(prompt.includes('system_diagnostics'));
    assert.ok(prompt.includes('SELECTIVE INTENT ROUTING RULE'));
  });

  test('12. Offline Python Controller runs system status & process list natively', async () => {
    const statusRes = await runPcController(['status']);
    assert.strictEqual(statusRes.success, true);
    assert.ok(statusRes.data.ram);
    assert.ok(statusRes.data.ram.totalGb > 0);
    assert.ok(statusRes.data.cpu.logicalCores > 0);

    const procRes = await runPcController(['process', 'list', '--limit', '5']);
    assert.strictEqual(procRes.success, true);
    assert.ok(Array.isArray(procRes.data));
    assert.ok(procRes.data.length > 0);
  });

  test('13. Zero-API FastPathRouter intercepts OS commands without LLM token cost', async () => {
    const statusRoute = await tryFastPathRoute('system status');
    assert.strictEqual(statusRoute.matched, true);
    assert.strictEqual(statusRoute.actionName, 'system_status');
    assert.ok(statusRoute.answer?.includes('Live System Metrics'));

    const muteRoute = await tryFastPathRoute('mute');
    assert.strictEqual(muteRoute.matched, true);
    assert.strictEqual(muteRoute.actionName, 'volume_mute');

    const nonMatchRoute = await tryFastPathRoute('explain general relativity in physics');
    assert.strictEqual(nonMatchRoute.matched, false);
  });

  test('14. CentralAssistant routes through fast-path with local_fastpath provider and 0 tokens', async () => {
    const assistant = new CentralAssistant();
    const res = await assistant.processRequest('show system stats');
    assert.strictEqual(res.providerUsed, 'local_fastpath');
    assert.strictEqual(res.agentUsed, 'System Agent (Offline Fast-Path)');
    assert.ok(res.answer.includes('Live System Metrics'));
    assert.ok(res.steps.length > 0);
  });
});

