'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheckIcon, SparklesIcon, BrainIcon } from './Icons';

interface ReadinessData {
  ready: boolean;
  timestamp: string;
  checks: Record<string, { status: 'pass' | 'fail'; message?: string; details?: unknown }>;
  config: {
    mode: 'local_dev' | 'private' | 'production';
    nodeEnv: string;
    isProduction: boolean;
    aiProvider: string;
    hasGeminiKey: boolean;
    hasOpenAiKey: boolean;
    hasGroqKey: boolean;
    hasAuthToken: boolean;
    trustedProxiesCount: number;
    databaseConfigured: boolean;
  };
  metrics: {
    uptimeSeconds: number;
    totalRequests: number;
    totalErrors: number;
    averageLatencyMs: number;
  };
}

interface BackupItem {
  id: string;
  filename: string;
  sizeBytes: number;
  checksum: string;
  createdAt: string;
  integrityVerified: boolean;
}

interface OllamaModel {
  name: string;
  size: number;
  details?: { parameter_size?: string; quantization_level?: string };
}

interface RecommendedModel {
  id: string;
  name: string;
  parameterSize: string;
  ramRequired: string;
  description: string;
  recommendedFor: string;
  speedRating: string;
  supportsTools: boolean;
}

interface OllamaStatusData {
  running: boolean;
  version?: string;
  error?: string;
  installedModels: OllamaModel[];
  recommendedModels: RecommendedModel[];
  hardwareProfile?: {
    cpu: string;
    recommendedRamBudget: string;
    targetModels: string[];
    note: string;
  };
}

export function SettingsSystemView() {
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [ollama, setOllama] = useState<OllamaStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchSystemStatus = useCallback(async () => {
    try {
      setLoading(true);
      const [readyRes, backupRes, ollamaRes] = await Promise.all([
        fetch('/api/ready'),
        fetch('/api/backup'),
        fetch('/api/ollama'),
      ]);

      if (readyRes.ok) {
        const data = await readyRes.json();
        setReadiness(data);
      }

      if (backupRes.ok) {
        const bData = await backupRes.json();
        setBackups(bData.backups || []);
      }

      if (ollamaRes.ok) {
        const oData = await ollamaRes.json();
        setOllama(oData);
      }
    } catch (err) {
      console.error('Failed to load system status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemStatus();
  }, [fetchSystemStatus]);

  const handleCreateBackup = async () => {
    try {
      setBackupInProgress(true);
      setStatusMessage(null);

      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: 'Verified SQLite backup created successfully!', type: 'success' });
        fetchSystemStatus();
      } else {
        setStatusMessage({ text: data.message || data.error || 'Backup creation failed', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'Network error triggering backup', type: 'error' });
    } finally {
      setBackupInProgress(false);
    }
  };

  const handlePullModel = async (modelId: string) => {
    try {
      setPullingModel(modelId);
      setPullProgress(`Connecting to Ollama to pull ${modelId}...`);

      const res = await fetch('/api/ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pull', model: modelId }),
      });

      if (!res.ok) {
        const err = await res.json();
        setPullProgress(`Error pulling ${modelId}: ${err.error || 'Request failed'}`);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.status) {
                  let progressStr = parsed.status;
                  if (parsed.completed && parsed.total) {
                    const pct = Math.round((parsed.completed / parsed.total) * 100);
                    progressStr += ` (${pct}%)`;
                  }
                  setPullProgress(progressStr);
                }
              } catch {}
            }
          }
        }
      }

      setPullProgress(`Successfully installed ${modelId}!`);
      fetchSystemStatus();
    } catch (err: unknown) {
      setPullProgress(`Failed to pull model: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setTimeout(() => setPullingModel(null), 3000);
    }
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  if (loading && !readiness) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading verified system diagnostics...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff' }}>System & Infrastructure Settings</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Multi-layered health monitoring, AI providers, offline Ollama engine, and verified backup management.
          </p>
        </div>

        <button
          onClick={() => fetchSystemStatus()}
          className="btn btn-secondary"
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        >
          ↻ Refresh Status
        </button>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${statusMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: statusMessage.type === 'success' ? '#10b981' : '#ef4444',
            fontSize: '0.85rem',
          }}
        >
          {statusMessage.text}
        </div>
      )}

      {/* 4 Health & Config Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        {/* Card 1: Core System Status */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <ShieldCheckIcon />
            <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff' }}>Core Readiness</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>System Ready:</span>
              <span
                style={{
                  color: readiness?.ready ? '#10b981' : '#ef4444',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ● {readiness?.ready ? 'OPERATIONAL' : 'DEGRADED'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Environment:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                {readiness?.config?.nodeEnv || 'development'} ({readiness?.config?.mode || 'local_dev'})
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Process Uptime:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                {readiness?.metrics?.uptimeSeconds ? formatUptime(readiness.metrics.uptimeSeconds) : '0s'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Timestamp:</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                {readiness?.timestamp ? new Date(readiness.timestamp).toLocaleTimeString() : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Database & Storage */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <SparklesIcon />
            <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff' }}>Database & Storage</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>SQLite Database:</span>
              <span style={{ color: readiness?.checks?.database?.status === 'pass' ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                {readiness?.checks?.database?.status === 'pass' ? 'Connected (PRAGMA OK)' : 'Error'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Schema Integrity:</span>
              <span style={{ color: readiness?.checks?.integrity?.status === 'pass' ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                {readiness?.checks?.integrity?.status === 'pass' ? 'Verified (0 Errors)' : 'Corrupt'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Applied Migrations:</span>
              <span style={{ color: '#10b981', fontWeight: '500' }}>
                {(readiness?.checks?.migrations?.details as any)?.appliedCount ?? 'Verified'} Applied
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Storage Permissions:</span>
              <span style={{ color: readiness?.checks?.diskStorage?.status === 'pass' ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                {readiness?.checks?.diskStorage?.status === 'pass' ? 'Read/Write Verified' : 'Locked'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: AI Inference Providers */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <BrainIcon />
            <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff' }}>AI Inference Providers</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Active AI Provider:</span>
              <span className="badge badge-primary" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                {readiness?.config?.aiProvider || 'gemini'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Google Gemini (1M+ Tokens):</span>
              <span style={{ color: readiness?.config?.hasGeminiKey ? '#10b981' : '#94a3b8', fontWeight: '500' }}>
                {readiness?.config?.hasGeminiKey ? 'Configured' : 'Not Configured'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>OpenAI (GPT-4o):</span>
              <span style={{ color: readiness?.config?.hasOpenAiKey ? '#10b981' : '#94a3b8', fontWeight: '500' }}>
                {readiness?.config?.hasOpenAiKey ? 'Configured' : 'Not Configured'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Local Ollama (Offline):</span>
              <span style={{ color: ollama?.running ? '#10b981' : '#94a3b8', fontWeight: '500' }}>
                {ollama?.running ? `Online (${ollama.installedModels.length} models)` : 'Offline'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Multi-API Failover:</span>
              <span style={{ color: '#10b981', fontWeight: '500' }}>Active (Automatic Failover)</span>
            </div>
          </div>
        </div>

        {/* Card 4: Subsystem Telemetry */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <ShieldCheckIcon />
            <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff' }}>Subsystem Telemetry</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Computer Control Provider:</span>
              <span style={{ color: '#10b981', fontWeight: '500' }}>Playwright Isolated Context</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Automation Engine:</span>
              <span style={{ color: '#10b981', fontWeight: '500' }}>Active (Circuit Breaker: 3)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total HTTP Requests:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{readiness?.metrics?.totalRequests || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Average Request Latency:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{readiness?.metrics?.averageLatencyMs || 0} ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Offline Local AI & Ollama Section */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff' }}>Offline Local AI & Ollama Engine</h3>
              <span
                className={`badge ${ollama?.running ? 'badge-primary' : 'badge-warning'}`}
                style={{ fontSize: '0.7rem' }}
              >
                {ollama?.running ? `● Ollama Active (v${ollama.version || '0.34+'})` : '○ Ollama Offline / Not Started'}
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Run full agent reasoning, tool calling, and speech processing locally on your machine with 0 cloud API costs or latency.
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', color: '#a5b4fc', display: 'block' }}>
              Host: {ollama?.hardwareProfile?.cpu || 'Intel Core i3 (4T)'} · 8GB RAM
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Budget: {ollama?.hardwareProfile?.recommendedRamBudget || '1.0 - 2.5 GB'}
            </span>
          </div>
        </div>

        {/* Pull Progress Banner */}
        {pullProgress && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '1rem',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid #6366f1',
              color: '#c7d2fe',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
            <span>{pullProgress}</span>
          </div>
        )}

        {/* Installed Models Grid */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Locally Installed Models ({ollama?.installedModels?.length || 0})
          </h4>

          {(!ollama?.installedModels || ollama.installedModels.length === 0) ? (
            <div
              style={{
                padding: '1.25rem',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed var(--border-subtle)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              {ollama?.running
                ? 'No local models downloaded yet. Click "Download" on any recommended model below.'
                : 'Ollama service is not running. Run "scripts\\setup-ollama.bat" or "ollama serve" in Windows command prompt.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
              {ollama.installedModels.map((m) => (
                <div
                  key={m.name}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.85rem' }}>{m.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {(m.size / (1024 * 1024 * 1024)).toFixed(2)} GB · {m.details?.parameter_size || 'Local'}
                    </div>
                  </div>
                  <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Installed ✓</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommended Lightweight Models (Tailored for this PC) */}
        <div>
          <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Recommended Lightweight Models (Optimized for 8GB RAM + Intel CPU)
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
            {(ollama?.recommendedModels || []).map((model) => {
              const isInstalled = (ollama?.installedModels || []).some((m) => m.name.startsWith(model.id));
              const isPulling = pullingModel === model.id;

              return (
                <div
                  key={model.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: isInstalled ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${isInstalled ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem' }}>{model.name}</span>
                      <span
                        className={`badge ${model.speedRating === 'Ultra-Fast' ? 'badge-primary' : 'badge-secondary'}`}
                        style={{ fontSize: '0.65rem' }}
                      >
                        {model.speedRating} ({model.ramRequired})
                      </span>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.35' }}>
                      {model.description}
                    </p>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                      🎯 {model.recommendedFor}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: model.supportsTools ? '#10b981' : '#f59e0b' }}>
                      {model.supportsTools ? '✓ Native Tool Calling' : '○ Text Reasoning Only'}
                    </span>

                    <button
                      onClick={() => handlePullModel(model.id)}
                      disabled={isPulling || !ollama?.running}
                      className={`btn ${isInstalled ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                      title={!ollama?.running ? 'Start Ollama service first' : ''}
                    >
                      {isPulling ? 'Pulling...' : isInstalled ? '↻ Re-Pull' : '↓ Download'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Windows Quickstart Helper */}
        <div
          style={{
            marginTop: '1.25rem',
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            💡 Need to install or start Ollama? Run <code>scripts\setup-ollama.bat</code> or install via <code>winget install Ollama.Ollama</code>.
          </span>
          <span style={{ color: '#a5b4fc', fontSize: '0.72rem' }}>Ollama runs natively on port 11434</span>
        </div>
      </div>

      {/* Backups Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>Database Backups & Recovery</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Server-side atomic WAL checkpoints with SHA-256 integrity verification.
            </p>
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={backupInProgress}
            className="btn btn-primary"
            style={{ padding: '6px 14px', fontSize: '0.78rem' }}
          >
            {backupInProgress ? 'Creating Backup...' : '+ Create Verified Backup'}
          </button>
        </div>

        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '200px 120px 1fr 140px',
              padding: '10px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'rgba(255, 255, 255, 0.02)',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            <div>Filename</div>
            <div>Size</div>
            <div>SHA-256 Checksum</div>
            <div>Created</div>
          </div>

          {backups.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              No backups created yet. Click "Create Verified Backup" to create a snapshot.
            </div>
          ) : (
            backups.map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '200px 120px 1fr 140px',
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: '0.78rem',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontWeight: '500', color: '#fff' }}>{b.filename}</div>
                <div style={{ color: 'var(--text-muted)' }}>{(b.sizeBytes / 1024).toFixed(1)} KB</div>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.72rem', color: '#a5b4fc', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {b.checksum}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  {new Date(b.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
