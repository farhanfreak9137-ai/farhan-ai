'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheckIcon } from './Icons';

interface SystemDiagnostics {
  os: {
    platform: string;
    release: string;
    type: string;
    arch: string;
    hostname: string;
    username: string;
    homeDirectory: string;
    uptime: string;
  };
  cpu: {
    model: string;
    cores: number;
  };
  memory: {
    totalGb: string;
    freeGb: string;
    usedGb: string;
    usagePercent: string;
  };
  diskDrives: Array<{ name: string; freeGb: string; usedGb: string }>;
  timestamp: string;
}

export function SystemControlPanel() {
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [command, setCommand] = useState('');
  const [shell, setShell] = useState<'powershell' | 'cmd'>('powershell');
  const [runningCmd, setRunningCmd] = useState(false);
  const [cmdResult, setCmdResult] = useState<any>(null);
  const [approvalPending, setApprovalPending] = useState<any>(null);
  const [appTarget, setAppTarget] = useState('');
  const [appStatus, setAppStatus] = useState<string | null>(null);
  const [fileList, setFileList] = useState<any[] | null>(null);
  const [fileListingPath, setFileListingPath] = useState<string>('%DOWNLOADS%');
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Load diagnostics
  const fetchDiagnostics = useCallback(async () => {
    setLoadingDiag(true);
    try {
      const res = await fetch('/api/system');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setDiagnostics(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch system diagnostics:', err);
    } finally {
      setLoadingDiag(false);
    }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [fetchDiagnostics]);

  // Execute terminal command
  const handleExecuteCommand = async (overrideCmd?: string, isApproved = false) => {
    const cmdToRun = overrideCmd || command;
    if (!cmdToRun.trim()) return;

    setRunningCmd(true);
    setCmdResult(null);
    setApprovalPending(null);

    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute_command',
          payload: { command: cmdToRun, shell },
          isHumanApproved: isApproved,
        }),
      });

      const data = await res.json();

      if (data.requiresHumanApproval) {
        setApprovalPending({
          command: cmdToRun,
          payload: data.approvalPayload,
        });
      } else {
        setCmdResult(data);
      }
    } catch (err: any) {
      setCmdResult({ success: false, error: err.message });
    } finally {
      setRunningCmd(false);
    }
  };

  // Launch application
  const handleLaunchApp = async (targetApp: string) => {
    if (!targetApp.trim()) return;
    setAppStatus(`Launching ${targetApp}...`);
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'launch_application',
          payload: { target: targetApp },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAppStatus(`Launched: ${targetApp}`);
      } else {
        setAppStatus(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setAppStatus(`Failed: ${err.message}`);
    } finally {
      setTimeout(() => setAppStatus(null), 4000);
    }
  };

  // Quick file explorer
  const handleListFiles = async (folderPath: string) => {
    setLoadingFiles(true);
    setFileListingPath(folderPath);
    try {
      const res = await fetch('/api/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'file_operations',
          payload: { action: 'list_directory', sourcePath: folderPath, maxItems: 30 },
          isHumanApproved: true,
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.items) {
        setFileList(data.data.items);
      } else {
        setFileList([]);
      }
    } catch (err) {
      console.error('Failed to list files:', err);
      setFileList([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-slate-900 border border-blue-500/20 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">Full Computer & OS Control</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Direct operating system automation: PowerShell/CMD execution, application launching, file operations, and hardware telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDiagnostics}
            disabled={loadingDiag}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition-colors"
          >
            {loadingDiag ? 'Refreshing...' : 'Refresh Hardware'}
          </button>
        </div>
      </div>

      {/* Hardware & Diagnostics Grid */}
      {diagnostics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* OS Card */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Host Machine</div>
            <div className="text-base font-semibold text-white mt-1 truncate">{diagnostics.os.hostname}</div>
            <div className="text-xs text-slate-400 mt-1">
              User: <span className="text-slate-200">{diagnostics.os.username}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Uptime: {diagnostics.os.uptime}</div>
          </div>

          {/* CPU Card */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Processor</div>
            <div className="text-sm font-semibold text-white mt-1 truncate" title={diagnostics.cpu.model}>
              {diagnostics.cpu.model}
            </div>
            <div className="text-xs text-blue-400 mt-1 font-mono">{diagnostics.cpu.cores} Cores Active</div>
          </div>

          {/* Memory Card */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium uppercase tracking-wider">RAM Usage</span>
              <span className="text-emerald-400 font-bold">{diagnostics.memory.usagePercent}</span>
            </div>
            <div className="text-base font-semibold text-white mt-1">
              {diagnostics.memory.usedGb} <span className="text-xs font-normal text-slate-400">/ {diagnostics.memory.totalGb}</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: diagnostics.memory.usagePercent }}
              ></div>
            </div>
          </div>

          {/* Disk Card */}
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Storage Drives</div>
            <div className="mt-1 space-y-1">
              {diagnostics.diskDrives.map((d, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="font-semibold text-white">{d.name}</span>
                  <span className="text-slate-400">{d.freeGb} free</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Command Prompt / PowerShell Runner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-slate-950/80 px-5 py-3 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
            </div>
            <span className="text-xs font-mono text-slate-300 ml-2 font-medium">Windows Terminal Execution</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShell('powershell')}
              className={`px-2.5 py-1 text-xs rounded font-mono transition-colors ${
                shell === 'powershell'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PowerShell
            </button>
            <button
              onClick={() => setShell('cmd')}
              className={`px-2.5 py-1 text-xs rounded font-mono transition-colors ${
                shell === 'cmd'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              CMD.exe
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Quick preset chips */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-slate-400 py-1">Quick Commands:</span>
            {[
              { label: 'Network Info', cmd: 'ipconfig' },
              { label: 'Check Winget', cmd: 'winget --version' },
              { label: 'Active Processes', cmd: 'Get-Process | Select-Object -First 10 ProcessName, CPU, WorkingSet' },
              { label: 'Git Status', cmd: 'git status' },
            ].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCommand(preset.cmd);
                  handleExecuteCommand(preset.cmd);
                }}
                className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded border border-slate-700/60 font-mono transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Command Input Box */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-blue-400 font-mono text-sm">&gt;</span>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleExecuteCommand();
                }}
                placeholder="e.g. winget search vlc, dir %DOWNLOADS%, ipconfig /all"
                className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button
              onClick={() => handleExecuteCommand()}
              disabled={runningCmd || !command.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-blue-600/20"
            >
              {runningCmd ? 'Executing...' : 'Run'}
            </button>
          </div>

          {/* Human Approval Required Alert */}
          {approvalPending && (
            <div className="bg-amber-950/40 border border-amber-500/30 p-4 rounded-xl space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <ShieldCheckIcon className="w-5 h-5" />
                Human Approval Required For System Command
              </div>
              <p className="text-xs text-slate-300">
                The command touches sensitive system state. Please review and authorize execution:
              </p>
              <div className="bg-slate-950 p-2.5 rounded font-mono text-xs text-amber-200">
                {approvalPending.command}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleExecuteCommand(approvalPending.command, true)}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Confirm & Execute
                </button>
                <button
                  onClick={() => setApprovalPending(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Terminal Output Viewer */}
          {cmdResult && (
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-72">
              <div className="flex justify-between items-center text-slate-500 pb-2 border-b border-slate-900 mb-2">
                <span>Exit Code: {cmdResult.data?.exitCode ?? (cmdResult.success ? 0 : 1)}</span>
                {cmdResult.data?.durationMs && <span>Duration: {cmdResult.data.durationMs}ms</span>}
              </div>

              {cmdResult.data?.stdout && (
                <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed">{cmdResult.data.stdout}</pre>
              )}
              {cmdResult.data?.stderr && (
                <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed mt-2">{cmdResult.data.stderr}</pre>
              )}
              {cmdResult.error && (
                <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed">{cmdResult.error}</pre>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick App Launcher & File Operations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* App Launcher */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Application Launcher</h3>
            {appStatus && <span className="text-xs text-blue-400 animate-pulse">{appStatus}</span>}
          </div>
          <p className="text-xs text-slate-400">
            Launch installed desktop programs or open files with default OS associations.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { name: 'Notepad', target: 'notepad' },
              { name: 'VS Code', target: 'code' },
              { name: 'Calculator', target: 'calc' },
              { name: 'Terminal', target: 'wt' },
              { name: 'Explorer', target: 'explorer' },
              { name: 'Edge', target: 'msedge' },
            ].map((app, idx) => (
              <button
                key={idx}
                onClick={() => handleLaunchApp(app.target)}
                className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/60 transition-all text-center hover:scale-[1.02]"
              >
                {app.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={appTarget}
              onChange={(e) => setAppTarget(e.target.value)}
              placeholder="e.g. chrome, spotify, excel"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => handleLaunchApp(appTarget)}
              disabled={!appTarget.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Launch
            </button>
          </div>
        </div>

        {/* File System Quick Inspector */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">File System Quick Access</h3>
            <span className="text-xs font-mono text-slate-400">{fileListingPath}</span>
          </div>

          <div className="flex gap-2">
            {[
              { label: 'Downloads', path: '%DOWNLOADS%' },
              { label: 'Documents', path: '%DOCUMENTS%' },
              { label: 'Desktop', path: '%DESKTOP%' },
            ].map((dir, idx) => (
              <button
                key={idx}
                onClick={() => handleListFiles(dir.path)}
                disabled={loadingFiles}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700/60 transition-colors"
              >
                {dir.label}
              </button>
            ))}
          </div>

          {/* File list preview */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 h-48 overflow-y-auto space-y-1.5 text-xs font-mono">
            {loadingFiles ? (
              <div className="text-slate-500 text-center py-10">Scanning directory...</div>
            ) : fileList && fileList.length > 0 ? (
              fileList.map((file, idx) => (
                <div key={idx} className="flex justify-between items-center py-1 px-1.5 hover:bg-slate-900 rounded">
                  <span className={`truncate mr-2 ${file.isDirectory ? 'text-blue-400 font-semibold' : 'text-slate-300'}`}>
                    {file.isDirectory ? '📁 ' : '📄 '}
                    {file.name}
                  </span>
                  <span className="text-slate-500 text-[10px] whitespace-nowrap">
                    {file.isDirectory ? 'DIR' : `${(file.sizeBytes / 1024).toFixed(0)} KB`}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-center py-10">
                Click Downloads, Documents, or Desktop above to inspect files.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
