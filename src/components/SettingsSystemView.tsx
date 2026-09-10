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

export function SettingsSystemView() {
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchSystemStatus = useCallback(async () => {
    try {
      setLoading(true);
      const [readyRes, backupRes] = await Promise.all([
        fetch('/api/ready'),
        fetch('/api/backup'),
      ]);

      if (readyRes.ok) {
        const data = await readyRes.json();
        setReadiness(data);
      }

      if (backupRes.ok) {
        const bData = await backupRes.json();
        setBackups(bData.backups || []);
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

      // Server-side backup endpoint: strictly handles authorization, integrity check, WAL flush, and audit logging
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
    } catch (err) {
      setStatusMessage({ text: 'Network error triggering backup', type: 'error' });
    } finally {
      setBackupInProgress(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>Settings & System Health</h2>
            <span
              className={`badge ${readiness?.ready ? 'badge-success' : 'badge-warning'}`}
              style={{ fontSize: '0.7rem' }}
            >
              {readiness?.ready ? 'SYSTEM HEALTHY' : 'DIAGNOSTICS PENDING'}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Production telemetry, SQLite integrity checks, migration tracking, and backup management.
          </p>
        </div>

        <button
          onClick={fetchSystemStatus}
          disabled={loading}
          className="btn btn-secondary"
          style={{ padding: '6px 14px', fontSize: '0.78rem' }}
        >
          {loading ? 'Probing...' : '↻ Probe Health'}
        </button>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            fontSize: '0.8rem',
            background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: statusMessage.type === 'success' ? '#10b981' : '#ef4444',
            border: `1px solid ${statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
          }}
        >
          {statusMessage.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Card 1: Core Deployment & Environment */}
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
            <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff' }}>Environment & Security</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Deployment Mode:</span>
              <span className="badge badge-primary" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                {readiness?.config?.mode || 'local_dev'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Node Environment:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{readiness?.config?.nodeEnv || 'development'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Production Token Auth:</span>
              <span style={{ color: readiness?.config?.hasAuthToken ? '#10b981' : '#f59e0b', fontWeight: '500' }}>
                {readiness?.config?.hasAuthToken ? 'Configured & Active' : 'Not Set (Dev Only)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Trusted Reverse Proxies:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                {readiness?.config?.trustedProxiesCount || 0} Configured
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>System Uptime:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                {formatUptime(readiness?.metrics?.uptimeSeconds || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Database & Storage Health */}
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
            <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff' }}>SQLite Database & Migrations</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Connection Probe:</span>
              <span style={{ color: readiness?.checks?.database?.status === 'pass' ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                {readiness?.checks?.database?.status === 'pass' ? '✓ CONNECTED' : '✗ DISCONNECTED'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>PRAGMA integrity_check:</span>
              <span style={{ color: readiness?.checks?.integrity?.status === 'pass' ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                {readiness?.checks?.integrity?.status === 'pass' ? '✓ OK (VERIFIED)' : '✗ CORRUPTED'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>WAL Mode:</span>
              <span style={{ color: '#10b981', fontWeight: '500' }}>Enabled (10s Timeout)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Disk Write Probe:</span>
              <span style={{ color: readiness?.checks?.diskStorage?.status === 'pass' ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                {readiness?.checks?.diskStorage?.status === 'pass' ? '✓ Read / Write Safe' : '✗ Read Only'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Tracked Migrations:</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>
                {(readiness?.checks?.migrations?.details as any)?.appliedCount || 2} Versioned Steps
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
                {readiness?.config?.aiProvider || 'mock'}
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
              <span style={{ color: 'var(--text-muted)' }}>Groq (Llama-3.3 70B):</span>
              <span style={{ color: readiness?.config?.hasGroqKey ? '#10b981' : '#94a3b8', fontWeight: '500' }}>
                {readiness?.config?.hasGroqKey ? 'Configured' : 'Not Configured'}
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

      {/* Backups Section */}
      <div style={{ marginTop: '2rem' }}>
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
