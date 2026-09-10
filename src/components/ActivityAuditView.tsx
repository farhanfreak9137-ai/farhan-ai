'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheckIcon, SparklesIcon, WorkflowIcon } from './Icons';

export interface AuditLogItem {
  id: string;
  timestamp: string;
  eventType: string;
  actor: string;
  action: string;
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED' | 'PENDING';
  ipAddress?: string;
  details?: Record<string, unknown>;
  error?: string;
}

type SubsystemFilter = 'all' | 'assistant' | 'career' | 'computer' | 'automation' | 'voice' | 'knowledge' | 'security';

export function ActivityAuditView() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubsystem, setSelectedSubsystem] = useState<SubsystemFilter>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      // Bounded retrieval limit = 50 to prevent unbounded payload
      const res = await fetch('/api/audit?limit=50');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Safe bounded interval polling if autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchLogs();
    }, 30000); // 30s safe bounded refresh
    return () => clearInterval(timer);
  }, [autoRefresh, fetchLogs]);

  // Map events to subsystems
  const filterMatchesSubsystem = (item: AuditLogItem, sub: SubsystemFilter): boolean => {
    if (sub === 'all') return true;
    const ev = item.eventType.toLowerCase();
    const act = item.action.toLowerCase();

    switch (sub) {
      case 'career':
        return ev.includes('workflow') || act.includes('application') || act.includes('proposal') || ev.includes('approval');
      case 'computer':
        return ev.includes('computer') || act.includes('browser') || ev.includes('emergency_stop');
      case 'automation':
        return ev.includes('automation') || act.includes('job') || act.includes('schedule');
      case 'voice':
        return ev.includes('voice') || act.includes('stt') || act.includes('tts') || act.includes('speak');
      case 'knowledge':
        return ev.includes('memory') || ev.includes('document') || act.includes('rag');
      case 'security':
        return ev.includes('auth') || ev.includes('rate_limit') || ev.includes('emergency') || ev.includes('shutdown') || ev.includes('integrity');
      case 'assistant':
        return act.includes('orchestrate') || act.includes('chat') || ev.includes('approval');
      default:
        return true;
    }
  };

  const filteredLogs = logs.filter((log) => filterMatchesSubsystem(log, selectedSubsystem));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.4)' };
      case 'FAILURE':
      case 'BLOCKED':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.4)' };
      case 'PENDING':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.4)' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>Activity & Audit Trail</h2>
            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
              Immutable SQLite Log
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Append-only security and operational audit trail with automated secret scrubbing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Auto-refresh (30s)
          </label>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.78rem' }}
          >
            {loading ? 'Refreshing...' : '↻ Refresh Log'}
          </button>
        </div>
      </div>

      {/* Subsystem Filter Pills */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {(
          [
            { id: 'all', label: 'All Subsystems' },
            { id: 'assistant', label: 'Assistant' },
            { id: 'career', label: 'Career' },
            { id: 'computer', label: 'Computer Control' },
            { id: 'automation', label: 'Automation' },
            { id: 'voice', label: 'Voice' },
            { id: 'knowledge', label: 'Knowledge & RAG' },
            { id: 'security', label: 'Security & Auth' },
          ] as { id: SubsystemFilter; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedSubsystem(tab.id)}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: selectedSubsystem === tab.id ? '600' : '400',
              color: selectedSubsystem === tab.id ? '#fff' : 'var(--text-secondary)',
              background: selectedSubsystem === tab.id ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Audit Log Table */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '170px 180px 140px 100px 1fr 90px',
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(255, 255, 255, 0.02)',
            fontSize: '0.75rem',
            fontWeight: '600',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <div>Timestamp</div>
          <div>Event Type</div>
          <div>Actor</div>
          <div>Status</div>
          <div>Action / Summary</div>
          <div>Details</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredLogs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {loading ? 'Loading audit records...' : 'No audit events recorded for this category.'}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const statusStyle = getStatusColor(log.status);
              const formattedDate = new Date(log.timestamp).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={log.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '170px 180px 140px 100px 1fr 90px',
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '0.8rem',
                    alignItems: 'center',
                    transition: 'background 0.15s ease',
                  }}
                  className="hover:bg-white/5"
                >
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {formattedDate}
                  </div>

                  <div style={{ fontWeight: '500', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                    {log.eventType}
                  </div>

                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {log.actor}
                  </div>

                  <div>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: '600',
                        background: statusStyle.bg,
                        color: statusStyle.text,
                        border: `1px solid ${statusStyle.border}`,
                      }}
                    >
                      {log.status}
                    </span>
                  </div>

                  <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.action}
                    {log.error && <span style={{ color: '#ef4444', marginLeft: '6px' }}>({log.error})</span>}
                  </div>

                  <div>
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="btn btn-ghost"
                      style={{ padding: '2px 8px', fontSize: '0.72rem', color: 'var(--color-primary)' }}
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Inspect Modal */}
      {selectedLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
          onClick={() => setSelectedLog(null)}
        >
          <div
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '650px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-xl)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheckIcon />
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>Audit Record Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-ghost"
                style={{ padding: '4px 8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.8rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}>
                <span style={{ color: 'var(--text-muted)' }}>ID:</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)' }}>{selectedLog.id}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}>
                <span style={{ color: 'var(--text-muted)' }}>Timestamp:</span>
                <span style={{ color: 'var(--text-primary)' }}>{selectedLog.timestamp}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}>
                <span style={{ color: 'var(--text-muted)' }}>Event Type:</span>
                <span style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{selectedLog.eventType}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}>
                <span style={{ color: 'var(--text-muted)' }}>Actor:</span>
                <span style={{ color: 'var(--text-primary)' }}>{selectedLog.actor}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span style={{ color: getStatusColor(selectedLog.status).text, fontWeight: '600' }}>{selectedLog.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}>
                <span style={{ color: 'var(--text-muted)' }}>Action:</span>
                <span style={{ color: 'var(--text-primary)' }}>{selectedLog.action}</span>
              </div>
              {selectedLog.error && (
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr' }}>
                  <span style={{ color: '#ef4444' }}>Error:</span>
                  <span style={{ color: '#ef4444' }}>{selectedLog.error}</span>
                </div>
              )}

              <div style={{ marginTop: '10px' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '500' }}>
                  Sanitized Details:
                </div>
                <pre
                  style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-subtle)',
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.72rem',
                    overflowX: 'auto',
                    color: '#a5b4fc',
                    maxHeight: '200px',
                  }}
                >
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setSelectedLog(null)} className="btn btn-secondary" style={{ padding: '6px 16px', fontSize: '0.8rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
