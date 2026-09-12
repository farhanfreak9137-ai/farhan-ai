import { z } from 'zod';
import { Agent, AgentTool, AgentExecutionContext } from './types';
import { logAuditEvent } from '@/lib/audit';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { runPcController } from './fastPathRouter';

const execAsync = promisify(exec);

/**
 * Expands Windows environment variables and common shorthand shortcuts:
 * %USERPROFILE%, %DOWNLOADS%, %DOCUMENTS%, %DESKTOP%, %APPDATA%, %TEMP%
 */
export function resolveSystemPath(rawPath: string): string {
  if (!rawPath) return rawPath;

  const home = os.homedir();
  let expanded = rawPath
    .replace(/%USERPROFILE%/gi, home)
    .replace(/%DOWNLOADS%/gi, path.join(home, 'Downloads'))
    .replace(/%DOCUMENTS%/gi, path.join(home, 'Documents'))
    .replace(/%DESKTOP%/gi, path.join(home, 'Desktop'))
    .replace(/%APPDATA%/gi, process.env.APPDATA || path.join(home, 'AppData', 'Roaming'))
    .replace(/%LOCALAPPDATA%/gi, process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'))
    .replace(/%TEMP%/gi, os.tmpdir());

  // Replace any remaining %ENV% vars
  expanded = expanded.replace(/%([^%]+)%/g, (_, n) => process.env[n] || _);

  return path.normalize(expanded);
}

/**
 * Checks whether a command is a software installation or potentially destructive operation.
 */
export function isMutatingOrDangerousCommand(cmd: string): boolean {
  const lower = cmd.toLowerCase();
  const dangerousPatterns = [
    /\bwinget\s+install\b/,
    /\bnpm\s+(i|install|uninstall|update)\b/,
    /\bpip\s+install\b/,
    /\bchoco\s+install\b/,
    /\bscoop\s+install\b/,
    /\bdel\s+(\/[a-z\s]+)?/i,
    /\brmdir\s+(\/[a-z\s]+)?/i,
    /\bformat\b/,
    /\breg\s+(add|delete)\b/,
    /\bshutdown\b/,
    /\btaskkill\b/,
    /\bstop-process\b/,
    /\bremove-item\b/,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(lower));
}

// -----------------------------------------------------------------------------
// Tool 1: execute_command
// -----------------------------------------------------------------------------
const executeCommandTool: AgentTool = {
  name: 'execute_command',
  description:
    'Executes a command via Windows PowerShell or Command Prompt. Use for installing applications (e.g. winget install), running build tools, system checks, and CLI automation.',
  agentId: 'system_agent',
  inputSchema: z.object({
    command: z
      .string()
      .min(1)
      .describe("The shell command to execute, e.g. 'winget install --id Google.Chrome', 'dir', 'git status'"),
    workingDirectory: z
      .string()
      .optional()
      .describe('Working directory path. Defaults to project directory.'),
    shell: z
      .enum(['powershell', 'cmd'])
      .default('powershell')
      .describe("Windows shell to use ('powershell' or 'cmd')"),
    timeoutSeconds: z
      .number()
      .min(1)
      .max(300)
      .default(30)
      .describe('Maximum execution time in seconds'),
  }),
  requiresHumanApproval: true,
  isMutation: true,
  buildApprovalPayload: (input, context) => ({
    actionType: 'system_command',
    title: `Authorize Command: ${input.command.slice(0, 60)}`,
    description: `The assistant requested to execute the following command in ${input.shell || 'powershell'}:\n\n\`${input.command}\``,
    payload: input,
  }),
  execute: async (input: any, context: AgentExecutionContext) => {
    const cwd = input.workingDirectory ? resolveSystemPath(input.workingDirectory) : process.cwd();
    const timeout = (input.timeoutSeconds || 30) * 1000;
    const isPowershell = input.shell !== 'cmd';
    const shellExe = isPowershell ? 'powershell.exe' : 'cmd.exe';

    const startTime = Date.now();
    try {
      const { stdout, stderr } = await execAsync(input.command, {
        cwd,
        timeout,
        shell: shellExe,
        maxBuffer: 10 * 1024 * 1024, // 10MB max buffer
      });

      const durationMs = Date.now() - startTime;

      await logAuditEvent({
        eventType: 'system_command_executed',
        actor: context.userId || 'system_agent',
        action: `execute_command: ${input.command.slice(0, 80)}`,
        status: 'SUCCESS',
        details: {
          command: input.command,
          shell: input.shell,
          cwd,
          durationMs,
        },
      });

      return {
        toolName: 'execute_command',
        success: true,
        data: {
          command: input.command,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: 0,
          durationMs,
        },
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const stdout = err.stdout ? String(err.stdout).trim() : '';
      const stderr = err.stderr ? String(err.stderr).trim() : err.message;

      await logAuditEvent({
        eventType: 'system_command_executed',
        actor: context.userId || 'system_agent',
        action: `execute_command: ${input.command.slice(0, 80)}`,
        status: 'FAILURE',
        error: stderr,
        details: { command: input.command, durationMs },
      });

      return {
        toolName: 'execute_command',
        success: false,
        error: `Command failed (exit code ${err.code || 1}): ${stderr}`,
        data: {
          command: input.command,
          stdout,
          stderr,
          exitCode: err.code || 1,
          durationMs,
        },
      };
    }
  },
};

// -----------------------------------------------------------------------------
// Tool 2: file_operations
// -----------------------------------------------------------------------------
const fileOperationsTool: AgentTool = {
  name: 'file_operations',
  description:
    'Performs file system operations across local Windows drives: moving files, copying, listing directory contents, creating directories, reading previews, or deleting files. Supports shortcuts like %DOWNLOADS%, %DOCUMENTS%, %DESKTOP%, %USERPROFILE%.',
  agentId: 'system_agent',
  inputSchema: z.object({
    action: z
      .enum(['list_directory', 'move_file', 'copy_file', 'create_directory', 'delete_file', 'read_file_preview'])
      .describe('File operation to perform'),
    sourcePath: z
      .string()
      .min(1)
      .describe('Source file or directory path (supports %DOWNLOADS%, %DOCUMENTS%, %DESKTOP%, etc.)'),
    destinationPath: z
      .string()
      .optional()
      .describe('Destination file or directory path for move/copy operations'),
    maxItems: z
      .number()
      .default(50)
      .describe('Max items to return for list_directory'),
  }),
  requiresHumanApproval: true,
  isMutation: true,
  buildApprovalPayload: (input, context) => ({
    actionType: 'file_operation',
    title: `Authorize File Operation: ${input.action}`,
    description: `The assistant requested to perform file operation '${input.action}' on: \`${input.sourcePath}\`${input.destinationPath ? ' -> `' + input.destinationPath + '`' : ''}`,
    payload: input,
  }),
  execute: async (input: any, context: AgentExecutionContext) => {
    const resolvedSource = resolveSystemPath(input.sourcePath);
    const resolvedDest = input.destinationPath ? resolveSystemPath(input.destinationPath) : undefined;

    try {
      switch (input.action) {
        case 'list_directory': {
          const entries = await fs.readdir(resolvedSource, { withFileTypes: true });
          const items = await Promise.all(
            entries.slice(0, input.maxItems || 50).map(async (entry) => {
              const fullPath = path.join(resolvedSource, entry.name);
              let size = 0;
              let mtime: string | undefined;
              try {
                const stat = await fs.stat(fullPath);
                size = stat.size;
                mtime = stat.mtime.toISOString();
              } catch {
                // Ignore stat errors for locked/permission-restricted files
              }
              return {
                name: entry.name,
                isDirectory: entry.isDirectory(),
                sizeBytes: size,
                lastModified: mtime,
                fullPath,
              };
            })
          );

          return {
            toolName: 'file_operations',
            success: true,
            data: {
              action: 'list_directory',
              directory: resolvedSource,
              totalFound: entries.length,
              items,
            },
          };
        }

        case 'move_file': {
          if (!resolvedDest) throw new Error('destinationPath is required for move_file');

          // Ensure parent directory of destination exists
          await fs.mkdir(path.dirname(resolvedDest), { recursive: true });

          try {
            await fs.rename(resolvedSource, resolvedDest);
          } catch (renameErr: any) {
            // If across distinct drives/filesystems (EXDEV), fallback to copy + unlink
            if (renameErr.code === 'EXDEV') {
              await fs.copyFile(resolvedSource, resolvedDest);
              await fs.unlink(resolvedSource);
            } else {
              throw renameErr;
            }
          }

          await logAuditEvent({
            eventType: 'file_operation_executed',
            actor: context.userId || 'system_agent',
            action: `move_file: ${resolvedSource} -> ${resolvedDest}`,
            status: 'SUCCESS',
            details: { source: resolvedSource, destination: resolvedDest },
          });

          return {
            toolName: 'file_operations',
            success: true,
            data: {
              action: 'move_file',
              source: resolvedSource,
              destination: resolvedDest,
              status: 'MOVED',
            },
          };
        }

        case 'copy_file': {
          if (!resolvedDest) throw new Error('destinationPath is required for copy_file');

          await fs.mkdir(path.dirname(resolvedDest), { recursive: true });
          await fs.copyFile(resolvedSource, resolvedDest);

          await logAuditEvent({
            eventType: 'file_operation_executed',
            actor: context.userId || 'system_agent',
            action: `copy_file: ${resolvedSource} -> ${resolvedDest}`,
            status: 'SUCCESS',
            details: { source: resolvedSource, destination: resolvedDest },
          });

          return {
            toolName: 'file_operations',
            success: true,
            data: {
              action: 'copy_file',
              source: resolvedSource,
              destination: resolvedDest,
              status: 'COPIED',
            },
          };
        }

        case 'create_directory': {
          await fs.mkdir(resolvedSource, { recursive: true });

          return {
            toolName: 'file_operations',
            success: true,
            data: {
              action: 'create_directory',
              path: resolvedSource,
              status: 'CREATED',
            },
          };
        }

        case 'delete_file': {
          // Extra safety check: never delete system roots
          const normalized = path.resolve(resolvedSource).toLowerCase();
          if (
            normalized === 'c:\\' ||
            normalized.startsWith('c:\\windows') ||
            normalized.startsWith('c:\\program files')
          ) {
            throw new Error(`Safety violation: Deleting protected system path '${resolvedSource}' is forbidden.`);
          }

          const stat = await fs.stat(resolvedSource);
          if (stat.isDirectory()) {
            await fs.rm(resolvedSource, { recursive: true });
          } else {
            await fs.unlink(resolvedSource);
          }

          await logAuditEvent({
            eventType: 'file_operation_executed',
            actor: context.userId || 'system_agent',
            action: `delete_file: ${resolvedSource}`,
            status: 'SUCCESS',
            details: { path: resolvedSource },
          });

          return {
            toolName: 'file_operations',
            success: true,
            data: {
              action: 'delete_file',
              path: resolvedSource,
              status: 'DELETED',
            },
          };
        }

        case 'read_file_preview': {
          const content = await fs.readFile(resolvedSource, 'utf-8');
          const preview = content.slice(0, 8192); // First 8KB

          return {
            toolName: 'file_operations',
            success: true,
            data: {
              action: 'read_file_preview',
              path: resolvedSource,
              preview,
              totalBytes: content.length,
            },
          };
        }

        default:
          throw new Error(`Unsupported file action: ${input.action}`);
      }
    } catch (err: any) {
      return {
        toolName: 'file_operations',
        success: false,
        error: `File operation '${input.action}' failed: ${err.message}`,
      };
    }
  },
};

// -----------------------------------------------------------------------------
// Tool 3: launch_application
// -----------------------------------------------------------------------------
const launchApplicationTool: AgentTool = {
  name: 'launch_application',
  description:
    "Launches an installed Windows desktop application (e.g. 'notepad', 'calc', 'code', 'chrome', or a file/URL with default association).",
  agentId: 'system_agent',
  inputSchema: z.object({
    target: z
      .string()
      .min(1)
      .describe("Application name, path, or URL to open, e.g. 'notepad', 'calc', 'code', 'msedge'"),
    args: z
      .array(z.string())
      .optional()
      .describe('Optional arguments for the application'),
  }),
  execute: async (input: any, context: AgentExecutionContext) => {
    try {
      let target = input.target.trim();
      const lower = target.toLowerCase();

      // Normalize common Windows application aliases
      const aliases: Record<string, string> = {
        'microsoft edge': 'msedge',
        'edge': 'msedge',
        'google chrome': 'chrome',
        'chrome': 'chrome',
        'calculator': 'calc',
        'notepad': 'notepad',
        'file explorer': 'explorer',
        'explorer': 'explorer',
        'visual studio code': 'code',
        'vs code': 'code',
        'vscode': 'code',
        'code': 'code',
        'powershell': 'powershell',
        'terminal': 'wt',
      };

      if (aliases[lower]) {
        target = aliases[lower];
      }

      const argsStr = input.args && input.args.length > 0 ? ' ' + input.args.join(' ') : '';
      const command = `start "" "${target}"${argsStr}`;

      // Launch application asynchronously via Windows shell
      await execAsync(command, { shell: 'cmd.exe' });

      await logAuditEvent({
        eventType: 'application_launched',
        actor: context.userId || 'system_agent',
        action: `launch_application: ${target}`,
        status: 'SUCCESS',
        details: { target, args: input.args },
      });

      return {
        toolName: 'launch_application',
        success: true,
        data: {
          target,
          status: 'LAUNCHED',
          message: `Successfully launched '${target}'`,
        },
      };
    } catch (err: any) {
      return {
        toolName: 'launch_application',
        success: false,
        error: `Failed to launch application '${input.target}': ${err.message}`,
      };
    }
  },
};

// -----------------------------------------------------------------------------
// Tool 4: system_diagnostics
// -----------------------------------------------------------------------------
const systemDiagnosticsTool: AgentTool = {
  name: 'system_diagnostics',
  description:
    'Retrieves real-time Windows system metrics including CPU model, RAM utilization, disk drive space, OS uptime, and current user info.',
  agentId: 'system_agent',
  inputSchema: z.object({}),
  execute: async () => {
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
    const memUsagePct = Math.round((usedMemBytes / totalMemBytes) * 100);

    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'Unknown CPU';
    const cpuCores = cpus.length;

    const uptimeSeconds = os.uptime();
    const uptimeHours = (uptimeSeconds / 3600).toFixed(1);

    // Fetch disk information via quick PowerShell query
    let diskDrives: Array<{ name: string; freeGb: string; usedGb: string }> = [];
    try {
      const { stdout } = await execAsync(
        'powershell.exe -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N=\'UsedGb\';E={[math]::Round($_.Used/1GB, 1)}}, @{N=\'FreeGb\';E={[math]::Round($_.Free/1GB, 1)}} | ConvertTo-Json"',
        { timeout: 5000 }
      );
      if (stdout.trim()) {
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        diskDrives = list.map((d: any) => ({
          name: `${d.Name}:`,
          usedGb: `${d.UsedGb || 0} GB`,
          freeGb: `${d.FreeGb || 0} GB`,
        }));
      }
    } catch {
      // Fallback: indicate drive C
      diskDrives = [{ name: 'C:', freeGb: 'Available', usedGb: 'N/A' }];
    }

    let pyData: any = null;
    try {
      const pyStatus = await runPcController(['status']);
      if (pyStatus.success && pyStatus.data) {
        pyData = pyStatus.data;
      }
    } catch {
      // Best effort Python metrics
    }

    return {
      toolName: 'system_diagnostics',
      success: true,
      data: {
        os: {
          platform: os.platform(),
          release: os.release(),
          type: os.type(),
          arch: os.arch(),
          hostname: os.hostname(),
          username: os.userInfo().username,
          homeDirectory: os.homedir(),
          uptime: `${uptimeHours} hours`,
        },
        cpu: {
          model: cpuModel,
          cores: cpuCores,
        },
        memory: {
          totalGb: pyData?.ram?.totalGb ? `${pyData.ram.totalGb} GB` : (totalMemBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
          freeGb: pyData?.ram?.freeGb ? `${pyData.ram.freeGb} GB` : (freeMemBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
          usedGb: pyData?.ram?.usedGb ? `${pyData.ram.usedGb} GB` : (usedMemBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
          usagePercent: pyData?.ram?.percentUsed ? `${pyData.ram.percentUsed}%` : `${memUsagePct}%`,
        },
        diskDrives,
        offlineMetrics: pyData,
        timestamp: new Date().toISOString(),
      },
    };

  },
};

// -----------------------------------------------------------------------------
// Tool 5: pc_window_control
// -----------------------------------------------------------------------------
const pcWindowControlTool: AgentTool = {
  name: 'pc_window_control',
  description:
    'Controls Windows desktop and application windows: minimize all windows to show desktop, or lock the workstation.',
  agentId: 'system_agent',
  inputSchema: z.object({
    action: z
      .enum(['minimize_all', 'lock'])
      .describe("Window action: 'minimize_all' to show desktop, or 'lock' to lock PC"),
  }),
  execute: async (input: { action: 'minimize_all' | 'lock' }) => {
    const res = await runPcController(['window', input.action]);
    return {
      toolName: 'pc_window_control',
      success: res.success,
      data: res,
    };
  },
};

// -----------------------------------------------------------------------------
// Tool 6: audio_media_control
// -----------------------------------------------------------------------------
const audioMediaControlTool: AgentTool = {
  name: 'audio_media_control',
  description:
    'Controls Windows master volume (mute, unmute, volume up/down) and media playback (play/pause, next track, previous track).',
  agentId: 'system_agent',
  inputSchema: z.object({
    category: z.enum(['volume', 'media']).describe('Category of control'),
    action: z
      .enum(['up', 'down', 'mute', 'play', 'pause', 'play_pause', 'next', 'prev', 'stop'])
      .describe('Action to perform'),
    steps: z.number().optional().default(2).describe('Steps for volume up/down (each step is 2%)'),
  }),
  execute: async (input: { category: 'volume' | 'media'; action: string; steps?: number }) => {
    let res;
    if (input.category === 'volume') {
      res = await runPcController(['volume', input.action, '--steps', String(input.steps || 2)]);
    } else {
      res = await runPcController(['media', input.action]);
    }
    return {
      toolName: 'audio_media_control',
      success: res.success,
      data: res,
    };
  },
};

// -----------------------------------------------------------------------------
// Tool 7: process_management
// -----------------------------------------------------------------------------
const processManagementTool: AgentTool = {
  name: 'process_management',
  description:
    'Lists top memory-consuming processes or terminates a process by name or PID.',
  agentId: 'system_agent',
  inputSchema: z.object({
    action: z.enum(['list', 'kill']).describe("Action: 'list' to view top processes, 'kill' to terminate"),
    target: z.string().optional().describe('Process name (e.g. notepad.exe) or PID to terminate'),
    limit: z.number().optional().default(15).describe('Max processes to return when listing'),
  }),
  execute: async (input: { action: 'list' | 'kill'; target?: string; limit?: number }) => {
    if (input.action === 'list') {
      const res = await runPcController(['process', 'list', '--limit', String(input.limit || 15)]);
      return { toolName: 'process_management', success: res.success, data: res.data };
    } else {
      if (!input.target) {
        return { toolName: 'process_management', success: false, error: 'target process is required for kill' };
      }
      const res = await runPcController(['process', 'kill', '--target', input.target, '--force']);
      return { toolName: 'process_management', success: res.success, data: res };
    }
  },
};

// -----------------------------------------------------------------------------
// Tool 8: screen_capture
// -----------------------------------------------------------------------------
const screenCaptureTool: AgentTool = {
  name: 'screen_capture',
  description:
    'Takes a screenshot of the Windows desktop and saves it locally in data/screenshots.',
  agentId: 'system_agent',
  inputSchema: z.object({}),
  execute: async () => {
    const res = await runPcController(['screenshot']);
    return {
      toolName: 'screen_capture',
      success: res.success,
      data: res,
    };
  },
};

// -----------------------------------------------------------------------------
// Tool 9: play_music
// -----------------------------------------------------------------------------
const playMusicTool: AgentTool = {
  name: 'play_music',
  description:
    'Plays requested songs, artists, playlists, or genres via Spotify, YouTube / YouTube Music, or local audio files.',
  agentId: 'system_agent',
  inputSchema: z.object({
    query: z.string().describe('Song title, artist, playlist, or genre (e.g. "Starboy The Weeknd", "Lo-fi study beats", "Interstellar theme")'),
    service: z.enum(['spotify', 'youtube', 'local', 'auto']).optional().default('auto').describe('Media service to use'),
  }),
  execute: async (input: { query: string; service?: 'spotify' | 'youtube' | 'local' | 'auto' }) => {
    const service = input.service || 'auto';
    const query = input.query.trim();

    try {
      if (service === 'spotify') {
        const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
        const res = await runPcController(['search', 'google', spotifyUrl]);
        return {
          toolName: 'play_music',
          success: res.success,
          data: { service: 'spotify', query, message: `Opened Spotify search for "${query}".` },
        };
      }

      if (service === 'local') {
        const musicDir = path.join(os.homedir(), 'Music');
        const res = await runPcController(['app', 'launch', 'wmplayer.exe']);
        return {
          toolName: 'play_music',
          success: res.success,
          data: { service: 'local', query, message: `Launched media player for local music in ${musicDir}.` },
        };
      }

      // Default: YouTube
      const res = await runPcController(['search', 'youtube', query]);
      return {
        toolName: 'play_music',
        success: res.success,
        data: { service: 'youtube', query, message: `Playing "${query}" on YouTube.` },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        toolName: 'play_music',
        success: false,
        error: `Failed playing music: ${msg}`,
      };
    }
  },
};

// -----------------------------------------------------------------------------
// Tool 10: organize_folder
// -----------------------------------------------------------------------------
const organizeFolderTool: AgentTool = {
  name: 'organize_folder',
  description:
    'Organizes cluttered directories (e.g. Downloads or Desktop) into categorized subfolders (Documents, Images, Code, Installers, Archives).',
  agentId: 'system_agent',
  inputSchema: z.object({
    targetDirectory: z.string().optional().default('%DOWNLOADS%').describe('Directory to organize (defaults to %DOWNLOADS%)'),
    dryRun: z.boolean().optional().default(true).describe('If true, previews planned file moves without modifying files'),
  }),
  execute: async (input: { targetDirectory?: string; dryRun?: boolean }) => {
    const rawTarget = input.targetDirectory || '%DOWNLOADS%';
    const resolvedDir = resolveSystemPath(rawTarget);
    const dryRun = input.dryRun !== false;

    try {
      const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
      const extensionsMap: Record<string, string> = {
        pdf: 'Documents',
        doc: 'Documents',
        docx: 'Documents',
        txt: 'Documents',
        xlsx: 'Documents',
        pptx: 'Documents',
        csv: 'Documents',
        png: 'Images',
        jpg: 'Images',
        jpeg: 'Images',
        gif: 'Images',
        svg: 'Images',
        webp: 'Images',
        mp4: 'Media',
        mkv: 'Media',
        mp3: 'Media',
        wav: 'Media',
        zip: 'Archives',
        rar: 'Archives',
        '7z': 'Archives',
        tar: 'Archives',
        gz: 'Archives',
        exe: 'Installers',
        msi: 'Installers',
        ts: 'Code',
        js: 'Code',
        py: 'Code',
        html: 'Code',
        css: 'Code',
        json: 'Code',
        cpp: 'Code',
        java: 'Code',
      };

      const plannedMoves: Array<{ file: string; from: string; to: string; category: string }> = [];

      for (const entry of entries) {
        if (!entry.isFile() || entry.name.startsWith('.')) continue;
        const ext = path.extname(entry.name).toLowerCase().replace(/^\./, '');
        const category = extensionsMap[ext];
        if (category) {
          const destDir = path.join(resolvedDir, category);
          const destFile = path.join(destDir, entry.name);
          const srcFile = path.join(resolvedDir, entry.name);
          plannedMoves.push({ file: entry.name, from: srcFile, to: destFile, category });
        }
      }

      if (dryRun) {
        return {
          toolName: 'organize_folder',
          success: true,
          data: {
            dryRun: true,
            targetDirectory: resolvedDir,
            filesToMoveCount: plannedMoves.length,
            plannedMoves: plannedMoves.slice(0, 30),
            message: `Found ${plannedMoves.length} files to organize into categories. Set dryRun: false to apply.`,
          },
        };
      }

      // Execute moves
      let movedCount = 0;
      for (const item of plannedMoves) {
        const destDir = path.dirname(item.to);
        await fs.mkdir(destDir, { recursive: true });
        await fs.rename(item.from, item.to);
        movedCount++;
      }

      return {
        toolName: 'organize_folder',
        success: true,
        data: {
          dryRun: false,
          targetDirectory: resolvedDir,
          movedCount,
          message: `Successfully organized ${movedCount} files in ${resolvedDir}.`,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        toolName: 'organize_folder',
        success: false,
        error: `Failed organizing folder: ${msg}`,
      };
    }
  },
};

// -----------------------------------------------------------------------------
// Tool 11: manage_github_repository
// -----------------------------------------------------------------------------
const manageGithubRepositoryTool: AgentTool = {
  name: 'manage_github_repository',
  description:
    'Manages Git repository actions (status, recent commits, staging, commit, push, create repo) on local workspaces.',
  agentId: 'system_agent',
  inputSchema: z.object({
    action: z.enum(['status', 'recent_commits', 'commit', 'push', 'create_repo']).describe('Git action to perform'),
    workingDir: z.string().optional().describe('Repository directory path (defaults to current project root)'),
    commitMessage: z.string().optional().describe('Commit message when action is "commit"'),
    repoName: z.string().optional().describe('GitHub repository name when action is "create_repo"'),
  }),
  execute: async (input: { action: 'status' | 'recent_commits' | 'commit' | 'push' | 'create_repo'; workingDir?: string; commitMessage?: string; repoName?: string }) => {
    const cwd = input.workingDir ? resolveSystemPath(input.workingDir) : process.cwd();

    try {
      if (input.action === 'status') {
        const { stdout } = await execAsync('git status -s', { cwd });
        return {
          toolName: 'manage_github_repository',
          success: true,
          data: { action: 'status', output: stdout || 'Working tree clean, no uncommitted changes.' },
        };
      }

      if (input.action === 'recent_commits') {
        const { stdout } = await execAsync('git log -n 5 --oneline', { cwd });
        return {
          toolName: 'manage_github_repository',
          success: true,
          data: { action: 'recent_commits', commits: stdout.trim().split('\n') },
        };
      }

      if (input.action === 'commit') {
        if (!input.commitMessage) {
          return { toolName: 'manage_github_repository', success: false, error: 'commitMessage is required for commit action' };
        }
        await execAsync('git add .', { cwd });
        const { stdout } = await execAsync(`git commit -m "${input.commitMessage.replace(/"/g, '\\"')}"`, { cwd });
        return {
          toolName: 'manage_github_repository',
          success: true,
          data: { action: 'commit', message: input.commitMessage, output: stdout },
        };
      }

      if (input.action === 'push') {
        const { stdout } = await execAsync('git push', { cwd });
        return {
          toolName: 'manage_github_repository',
          success: true,
          data: { action: 'push', output: stdout },
        };
      }

      if (input.action === 'create_repo') {
        const repo = input.repoName || path.basename(cwd);
        const { stdout } = await execAsync(`gh repo create "${repo}" --private --source=. --push`, { cwd }).catch(async () => {
          return await execAsync('git remote -v', { cwd });
        });
        return {
          toolName: 'manage_github_repository',
          success: true,
          data: { action: 'create_repo', repo, output: stdout },
        };
      }

      return { toolName: 'manage_github_repository', success: false, error: `Unknown action: ${input.action}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        toolName: 'manage_github_repository',
        success: false,
        error: `Git action failed: ${msg}`,
      };
    }
  },
};

// -----------------------------------------------------------------------------
// SystemAgent Declaration
// -----------------------------------------------------------------------------
export const SystemAgent: Agent = {
  id: 'system_agent',
  name: 'System Agent',
  description:
    'Full Windows operating system control: offline file management, process termination, window/desktop control, audio/media keys, music playback, Git/GitHub actions, smart folder organization, screen capture, CLI commands, and real-time hardware diagnostics.',
  capabilities: [
    'command_execution',
    'file_manipulation',
    'application_launching',
    'system_diagnostics',
    'software_installation',
    'window_control',
    'audio_media_control',
    'process_management',
    'screen_capture',
    'music_playback',
    'folder_organization',
    'git_management',
  ],
  tools: [
    executeCommandTool,
    fileOperationsTool,
    launchApplicationTool,
    systemDiagnosticsTool,
    pcWindowControlTool,
    audioMediaControlTool,
    processManagementTool,
    screenCaptureTool,
    playMusicTool,
    organizeFolderTool,
    manageGithubRepositoryTool,
  ],
};

