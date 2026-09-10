'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ComputerIcon, StopIcon, ShieldCheckIcon } from './Icons';
import { SystemControlPanel } from './SystemControlPanel';

interface ComputerActionRecord {
  id: string;
  sessionId: string;
  action: string;
  payload: any;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'EXECUTING' | 'COMPLETED' | 'DENIED' | 'CANCELLED' | 'FAILED' | string;
  result?: any;
  createdAt: string;
  updatedAt?: string;
}

interface PageObservation {
  url: string;
  title: string;
  visibleText: string;
  interactiveElements: Array<{
    elementId: string;
    role: string;
    text?: string;
    ariaLabel?: string;
    tag: string;
    visible: boolean;
    enabled: boolean;
  }>;
  forms: Array<{
    formId: string;
    fields: Array<{ fieldId: string; name: string; type: string; label?: string }>;
  }>;
  timestamp: string;
}

export function ComputerDashboard() {
  const [activeMode, setActiveMode] = useState<'system' | 'browser'>('system');
  const [sessions, setSessions] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [actions, setActions] = useState<ComputerActionRecord[]>([]);
  const [observation, setObservation] = useState<PageObservation | null>(null);
  const [providerState, setProviderState] = useState<string>('REAL');
  const [loading, setLoading] = useState(false);
  const [navUrl, setNavUrl] = useState('https://example.com');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [stopSuccess, setStopSuccess] = useState<boolean>(false);

  const notify = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Fetch actions and provider state
  const loadActions = useCallback(async () => {
    try {
      const res = await fetch('/api/computer/actions?limit=50');
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions || []);
        if (data.providerState) setProviderState(data.providerState);

        // Extract unique session IDs from actions
        const foundSessions = Array.from(new Set<string>(
          (data.actions || [])
            .map((a: ComputerActionRecord) => a.sessionId)
            .filter(Boolean)
        ));
        setSessions((prev) => {
          const merged = Array.from(new Set([...prev, ...foundSessions]));
          if (!activeSessionId && merged.length > 0) {
            setActiveSessionId(merged[0]);
          }
          return merged;
        });
      }
    } catch (err) {
      console.error('Failed to load computer actions:', err);
    }
  }, [activeSessionId]);

  useEffect(() => {
    loadActions();
    const interval = setInterval(loadActions, 3000);
    return () => clearInterval(interval);
  }, [loadActions]);

  // Create Session
  const handleCreateSession = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/computer/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'createSession', payload: {} }),
      });
      const data = await res.json();
      if (res.ok && data.result?.sessionId) {
        const newSid = data.result.sessionId;
        setSessions((prev) => [newSid, ...prev]);
        setActiveSessionId(newSid);
        setStopSuccess(false);
        notify(`New isolated Chromium session created: ${newSid.substring(0, 8)}...`);
        await loadActions();
      } else {
        notify(`Failed to create session: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      notify('Network error creating browser session');
    } finally {
      setLoading(false);
    }
  };

  // Navigate
  const handleNavigate = async () => {
    if (!activeSessionId) {
      notify('Please select or create a session first');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/computer/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'navigate',
          sessionId: activeSessionId,
          payload: { url: navUrl },
        }),
      });
      const data = await res.json();
      if (res.status === 202) {
        notify(`Navigation queued. Request ID: ${data.requestId?.substring(0, 8)}... requires approval.`);
      } else if (res.ok) {
        notify(`Navigated to ${navUrl}`);
        handleObserve();
      } else {
        notify(`Navigation rejected: ${data.error || 'Policy denied'}`);
      }
      await loadActions();
    } catch (err) {
      notify('Navigation failed due to network error');
    } finally {
      setLoading(false);
    }
  };

  // Observe
  const handleObserve = async () => {
    if (!activeSessionId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/computer/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'observe',
          sessionId: activeSessionId,
          payload: {},
        }),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        setObservation(data.result as PageObservation);
        notify('Page state observed successfully');
      } else {
        notify(`Observe failed: ${data.error || 'Session not responding'}`);
      }
      await loadActions();
    } catch (err) {
      notify('Failed to observe page state');
    } finally {
      setLoading(false);
    }
  };

  // Close Session
  const handleCloseSession = async () => {
    if (!activeSessionId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/computer/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          sessionId: activeSessionId,
          payload: {},
        }),
      });
      if (res.ok) {
        notify(`Session ${activeSessionId.substring(0, 8)} closed.`);
        setSessions((prev) => prev.filter((s) => s !== activeSessionId));
        setActiveSessionId('');
        setObservation(null);
      }
      await loadActions();
    } catch (err) {
      notify('Failed to close session');
    } finally {
      setLoading(false);
    }
  };

  // Emergency STOP
  const handleEmergencyStop = async () => {
    if (!activeSessionId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/computer/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId }),
      });
      const data = await res.json();
      if (res.ok) {
        setStopSuccess(true);
        notify(`EMERGENCY STOP EXECUTED: Session killed, ${data.cancelledActions?.length || 0} action(s) cancelled.`);
        setObservation(null);
      } else {
        notify(`Stop request error: ${data.error}`);
      }
      await loadActions();
    } catch (err) {
      notify('Failed to execute emergency stop');
    } finally {
      setLoading(false);
    }
  };

  // Approve / Deny Action
  const handleApprovalDecision = async (requestId: string, approve: boolean) => {
    setLoading(true);
    try {
      const res = await fetch('/api/computer/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, approve }),
      });
      const data = await res.json();
      if (res.ok) {
        notify(`Action ${approve ? 'APPROVED and executed' : 'DENIED'}.`);
        if (approve) handleObserve();
      } else {
        notify(`Approval error: ${data.error || 'Failed'}`);
      }
      await loadActions();
    } catch (err) {
      notify('Error submitting approval decision');
    } finally {
      setLoading(false);
    }
  };

  const pendingApprovals = actions.filter((a) => a.status === 'PENDING_APPROVAL');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Pending Approval</span>;
      case 'APPROVED':
        return <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Approved</span>;
      case 'EXECUTING':
        return <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Executing...</span>;
      case 'COMPLETED':
        return <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Completed</span>;
      case 'DENIED':
        return <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>Denied</span>;
      case 'CANCELLED':
        return <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af' }}>Cancelled</span>;
      case 'FAILED':
        return <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }}>Failed</span>;
      default:
        return <span className="badge" style={{ fontSize: '0.7rem' }}>{status}</span>;
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '1.25rem', gap: '1rem', background: 'var(--bg-main)' }}>
      {/* Top Banner: Status & Session Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '0.875rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <ComputerIcon className="w-5 h-5" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#fff', margin: 0 }}>Computer Control Dashboard</h2>
              <span className={`badge ${providerState === 'REAL' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.7rem' }}>
                Provider: {providerState} (Chromium)
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Isolated Playwright Chromium runtime with policy enforcement and immutable human approval boundaries.
            </p>
          </div>
        </div>

        {/* Emergency STOP Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleEmergencyStop}
            disabled={!activeSessionId || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: '700',
              color: '#fff',
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              border: '1px solid #ef4444',
              borderRadius: 'var(--radius-md)',
              cursor: activeSessionId ? 'pointer' : 'not-allowed',
              opacity: activeSessionId ? 1 : 0.5,
              boxShadow: '0 0 14px rgba(220, 38, 38, 0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            <StopIcon className="w-4 h-4" />
            <span>EMERGENCY STOP</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {statusMessage && (
        <div style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#93c5fd', fontSize: '0.8rem' }}>
          ℹ {statusMessage}
        </div>
      )}

      {/* Emergency Stop Banner */}
      {stopSuccess && (
        <div style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🛑</span>
          <strong>Emergency Stop Active:</strong> Session was killed. Any further execution on this session is rejected.
        </div>
      )}

      {/* Mode Switcher */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setActiveMode('system')}
          style={{
            padding: '7px 16px',
            fontSize: '0.8rem',
            fontWeight: '600',
            borderRadius: 'var(--radius-sm)',
            border: activeMode === 'system' ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
            background: activeMode === 'system' ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'var(--bg-surface-elevated)',
            color: activeMode === 'system' ? '#fff' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: activeMode === 'system' ? '0 0 12px rgba(37, 99, 235, 0.3)' : 'none',
          }}
        >
          🖥️ Full OS & System Controls (PowerShell, Winget, Files)
        </button>
        <button
          onClick={() => setActiveMode('browser')}
          style={{
            padding: '7px 16px',
            fontSize: '0.8rem',
            fontWeight: '600',
            borderRadius: 'var(--radius-sm)',
            border: activeMode === 'browser' ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
            background: activeMode === 'browser' ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'var(--bg-surface-elevated)',
            color: activeMode === 'browser' ? '#fff' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: activeMode === 'browser' ? '0 0 12px rgba(37, 99, 235, 0.3)' : 'none',
          }}
        >
          🌐 Browser Automation (Chromium Playwright)
        </button>
      </div>

      {activeMode === 'system' ? (
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          <SystemControlPanel />
        </div>
      ) : (
        <>
          {/* Session Controls Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', background: 'var(--bg-surface-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
        {/* Session Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Session:</span>
          <select
            value={activeSessionId}
            onChange={(e) => setActiveSessionId(e.target.value)}
            style={{
              background: 'var(--bg-main)',
              color: '#fff',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 10px',
              fontSize: '0.78rem',
              minWidth: '180px',
            }}
          >
            {sessions.length === 0 ? (
              <option value="">No Active Sessions</option>
            ) : (
              sessions.map((sid) => (
                <option key={sid} value={sid}>
                  {sid.substring(0, 12)}...
                </option>
              ))
            )}
          </select>
        </div>

        {/* Create Session Button */}
        <button
          onClick={handleCreateSession}
          disabled={loading}
          className="btn btn-primary"
          style={{ padding: '5px 12px', fontSize: '0.76rem' }}
        >
          + New Session
        </button>

        {/* Close Session Button */}
        {activeSessionId && (
          <button
            onClick={handleCloseSession}
            disabled={loading}
            className="btn btn-secondary"
            style={{ padding: '5px 10px', fontSize: '0.76rem', color: '#f87171' }}
          >
            Close Session
          </button>
        )}

        {/* Navigation Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '300px' }}>
          <input
            type="text"
            value={navUrl}
            onChange={(e) => setNavUrl(e.target.value)}
            placeholder="https://example.com"
            style={{
              flex: 1,
              background: 'var(--bg-main)',
              color: '#fff',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 10px',
              fontSize: '0.78rem',
            }}
          />
          <button
            onClick={handleNavigate}
            disabled={!activeSessionId || loading}
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: '0.76rem' }}
          >
            Navigate
          </button>
          <button
            onClick={handleObserve}
            disabled={!activeSessionId || loading}
            className="btn btn-secondary"
            style={{ padding: '5px 10px', fontSize: '0.76rem' }}
          >
            Observe
          </button>
        </div>
      </div>

      {/* Main Content Grid: Left (Pending & Observation), Right (Action History) */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', minHeight: 0 }}>
        {/* Left Column: Pending Approvals & Browser Observation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          {/* Pending Approvals Card */}
          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheckIcon className="w-4 h-4" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff', margin: 0 }}>
                  Pending Consequential Approvals ({pendingApprovals.length})
                </h3>
              </div>
            </div>

            {pendingApprovals.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                No pending actions requiring human approval. Consequential browser actions (navigation, form fills, clicks, typing) will wait here for explicit authorization.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingApprovals.map((act) => (
                  <div
                    key={act.id}
                    style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div>
                        <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#fbbf24' }}>
                          Action: {act.action.toUpperCase()}
                        </span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          Request ID: <code>{act.id}</code>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleApprovalDecision(act.id, true)}
                          disabled={loading}
                          className="btn btn-primary"
                          style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                        >
                          Authorize
                        </button>
                        <button
                          onClick={() => handleApprovalDecision(act.id, false)}
                          disabled={loading}
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#f87171' }}
                        >
                          Deny
                        </button>
                      </div>
                    </div>

                    {/* Payload Details */}
                    <pre
                      style={{
                        background: 'var(--bg-main)',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        color: 'var(--text-secondary)',
                        overflowX: 'auto',
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(act.payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Browser Observation Inspector */}
          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff', margin: 0 }}>
                Live Page Observation
              </h3>
              {observation && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Observed at {new Date(observation.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>

            {!observation ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {activeSessionId ? 'Click "Observe" above to inspect page elements and DOM.' : 'Select or create a session to observe.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
                <div style={{ background: 'var(--bg-main)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>URL:</div>
                  <div style={{ fontSize: '0.78rem', color: '#38bdf8', wordBreak: 'break-all' }}>{observation.url}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Title:</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#fff' }}>{observation.title || '(No Title)'}</div>
                </div>

                {/* Interactive Elements */}
                <div>
                  <div style={{ fontSize: '0.76rem', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                    Interactive Elements ({observation.interactiveElements?.length || 0})
                  </div>
                  <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {observation.interactiveElements?.slice(0, 15).map((el, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--bg-surface-elevated)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                        }}
                      >
                        <span style={{ color: '#a78bfa' }}>[{el.tag}] {el.text || el.ariaLabel || el.role}</span>
                        <code style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{el.elementId}</code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Forms */}
                {observation.forms && observation.forms.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.76rem', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                      Forms Detected ({observation.forms.length})
                    </div>
                    {observation.forms.map((f, fIdx) => (
                      <div key={fIdx} style={{ background: 'var(--bg-main)', padding: '6px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>
                        <span style={{ fontWeight: '600', color: '#fbbf24' }}>Form: {f.formId}</span>
                        <div style={{ marginTop: '2px', color: 'var(--text-secondary)' }}>
                          Fields: {f.fields.map((fld) => `${fld.name || fld.fieldId} (${fld.type})`).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Action Execution History Timeline */}
        <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff', margin: 0 }}>
              Action Lifecycle Audit Trail ({actions.length})
            </h3>
            <button
              onClick={loadActions}
              className="btn btn-secondary"
              style={{ padding: '3px 8px', fontSize: '0.7rem' }}
            >
              Refresh
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {actions.length === 0 ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                No actions executed yet. Create a session or navigate to generate audit records.
              </p>
            ) : (
              actions.map((act) => (
                <div
                  key={act.id}
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: '600', color: '#fff' }}>
                      {act.action}
                    </span>
                    {getStatusBadge(act.status)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    <span>Session: {act.sessionId?.substring(0, 8)}...</span>
                    <span>{new Date(act.createdAt).toLocaleTimeString()}</span>
                  </div>

                  {act.result && (
                    <div style={{ fontSize: '0.68rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '4px 6px', borderRadius: '3px' }}>
                      Result: {typeof act.result === 'object' ? JSON.stringify(act.result) : String(act.result)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )}
</div>
);
}
