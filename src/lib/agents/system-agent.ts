import { z } from 'zod';
import { Agent, AgentTool, AgentExecutionContext } from './types';
import { logAuditEvent } from '@/lib/audit';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

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
      const argsStr = input.args && input.args.length > 0 ? ' ' + input.args.join(' ') : '';
      const command = `start "" "${input.target}"${argsStr}`;

      // Spawn detached process so it doesn't wait or freeze the server
      const child = spawn('cmd.exe', ['/c', command], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      await logAuditEvent({
        eventType: 'application_launched',
        actor: context.userId || 'system_agent',
        action: `launch_application: ${input.target}`,
        status: 'SUCCESS',
        details: { target: input.target, args: input.args },
      });

      return {
        toolName: 'launch_application',
        success: true,
        data: {
          target: input.target,
          status: 'LAUNCHED',
          message: `Successfully launched '${input.target}'`,
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
          totalGb: (totalMemBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
          freeGb: (freeMemBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
          usedGb: (usedMemBytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB',
          usagePercent: `${memUsagePct}%`,
        },
        diskDrives,
        timestamp: new Date().toISOString(),
      },
    };
  },
};

// -----------------------------------------------------------------------------
// SystemAgent Declaration
// -----------------------------------------------------------------------------
export const SystemAgent: Agent = {
  id: 'system_agent',
  name: 'System Agent',
  description:
    'Full Windows operating system control: file management (move, copy, delete), command line execution (winget, powershell, cmd), application launching, and hardware diagnostics.',
  capabilities: [
    'command_execution',
    'file_manipulation',
    'application_launching',
    'system_diagnostics',
    'software_installation',
  ],
  tools: [
    executeCommandTool,
    fileOperationsTool,
    launchApplicationTool,
    systemDiagnosticsTool,
  ],
};
