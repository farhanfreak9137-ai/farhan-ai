'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AutomationJob, AutomationRun, AutomationApproval, TaskType, JobType } from '@/lib/automation/types';
import { AppNotification } from '@/lib/notifications/types';
import { SparklesIcon, ShieldCheckIcon, StopIcon, WorkflowIcon } from '@/components/Icons';

export function AutomationDashboard() {
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [approvals, setApprovals] = useState<AutomationApproval[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'jobs' | 'runs' | 'approvals' | 'notifications'>('jobs');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // New Job Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [newJobDescription, setNewJobDescription] = useState('');
  const [newJobType, setNewJobType] = useState<JobType>('interval');
  const [newJobSchedule, setNewJobSchedule] = useState('60000');
  const [newJobTaskType, setNewJobTaskType] = useState<TaskType>('opportunity_monitor');
  const [newJobQuery, setNewJobQuery] = useState('Senior AI Systems Engineer');

  // Load all dashboard data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [jobsRes, runsRes, approvalsRes, notifRes] = await Promise.all([
        fetch('/api/automation'),
        fetch('/api/automation/runs/list').catch(() => fetch('/api/automation')), // fallback
        fetch('/api/automation/approvals'),
        fetch('/api/notifications'),
      ]);

      if (jobsRes.ok) {
        const d = await jobsRes.json();
        setJobs(d.jobs || []);
      }

      if (approvalsRes.ok) {
        const d = await approvalsRes.json();
        setApprovals(d.approvals || []);
      }

      if (notifRes.ok) {
        const d = await notifRes.json();
        setNotifications(d.notifications || []);
      }

      // Fetch runs for all jobs
      const rRes = await fetch('/api/automation');
      if (rRes.ok) {
        // fetch runs
        const jobData = await rRes.json();
        if (jobData.jobs && jobData.jobs.length > 0) {
          const firstJobId = jobData.jobs[0].id;
          const runsResp = await fetch(`/api/automation/${firstJobId}/runs`);
          if (runsResp.ok) {
            const rd = await runsResp.json();
            setRuns(rd.runs || []);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load automation data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  const showFeedback = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Job Actions
  const handleRunNow = async (id: string) => {
    try {
      const res = await fetch(`/api/automation/${id}/run`, { method: 'POST' });
      if (res.ok) {
        showFeedback('Job run triggered immediately.');
        await loadData();
      }
    } catch (err: any) {
      showFeedback('Failed to run job: ' + err.message);
    }
  };

  const handlePauseResume = async (job: AutomationJob) => {
    const endpoint = job.status === 'PAUSED' ? 'resume' : 'pause';
    try {
      const res = await fetch(`/api/automation/${job.id}/${endpoint}`, { method: 'POST' });
      if (res.ok) {
        showFeedback(`Job ${endpoint === 'resume' ? 'resumed' : 'paused'}.`);
        await loadData();
      }
    } catch (err: any) {
      showFeedback('Action failed: ' + err.message);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled automation?')) return;
    try {
      const res = await fetch(`/api/automation/${id}/cancel`, { method: 'POST' });
      if (res.ok) {
        showFeedback('Job cancelled.');
        await loadData();
      }
    } catch (err: any) {
      showFeedback('Cancel failed: ' + err.message);
    }
  };

  const handleApprovalAction = async (approvalId: string, approve: boolean) => {
    try {
      const endpoint = approve ? 'approve' : 'deny';
      const res = await fetch(`/api/automation/approvals/${approvalId}/${endpoint}`, { method: 'POST' });
      if (res.ok) {
        showFeedback(`Approval ${approve ? 'granted' : 'rejected'}.`);
        await loadData();
      }
    } catch (err: any) {
      showFeedback('Failed to process approval: ' + err.message);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let taskPayload: Record<string, unknown> = {};
      if (newJobTaskType === 'opportunity_monitor') {
        taskPayload = { query: newJobQuery, workModel: 'remote' };
      } else if (newJobTaskType === 'research_monitor') {
        taskPayload = { query: newJobQuery };
      } else {
        taskPayload = { prompt: newJobQuery };
      }

      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newJobName,
          description: newJobDescription,
          type: newJobType,
          schedule: newJobSchedule,
          taskType: newJobTaskType,
          taskPayload,
          enabled: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create job');
      }

      setShowCreateModal(false);
      setNewJobName('');
      setNewJobDescription('');
      showFeedback('New automation job registered successfully.');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const activeCount = jobs.filter((j) => j.status === 'SCHEDULED' || j.status === 'RUNNING').length;
  const pausedCount = jobs.filter((j) => j.status === 'PAUSED').length;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.25rem 1.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(14, 165, 233, 0.4)',
            }}
          >
            <WorkflowIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Background Automation Engine
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0 0' }}>
              Persistent SQLite-backed jobs, recurring opportunity monitors, and approval gates
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            border: 'none',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
          }}
        >
          <SparklesIcon className="w-4 h-4" />
          + Create Automation
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Active Jobs</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.35rem' }}>{activeCount}</div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{pausedCount} paused</span>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Pending Approvals</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: approvals.length > 0 ? '#facc15' : '#4ade80', marginTop: '0.35rem' }}>
            {approvals.length}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Awaiting explicit human review</span>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Recent Executions</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#a855f7', marginTop: '0.35rem' }}>{runs.length}</div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Traceable SQLite run logs</span>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.25rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>System Alerts</span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f43f5e', marginTop: '0.35rem' }}>
            {notifications.filter((n) => !n.read).length}
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Unread notifications</span>
        </div>
      </div>

      {/* Action feedback toast */}
      {actionMessage && (
        <div
          style={{
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: '#93c5fd',
            fontSize: '0.85rem',
          }}
        >
          {actionMessage}
        </div>
      )}

      {/* Pending Approvals Section (if any) */}
      {approvals.length > 0 && (
        <div
          style={{
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '14px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldCheckIcon className="w-5 h-5 text-yellow-400" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fef08a', margin: 0 }}>
              Pending Background Approvals ({approvals.length})
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#fef9c3', margin: 0 }}>
            Automations paused at consequential action boundaries. Background tasks will never execute external mutations without human confirmation.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {approvals.map((appr) => (
              <div
                key={appr.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(234, 179, 8, 0.2)',
                  borderRadius: '10px',
                  padding: '0.85rem 1.25rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>{appr.actionType}</div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '0.2rem' }}>{appr.reason}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Run ID: {appr.runId} • Queued: {new Date(appr.createdAt).toLocaleTimeString()}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleApprovalAction(appr.id, true)}
                    style={{
                      padding: '0.45rem 0.9rem',
                      borderRadius: '8px',
                      background: '#22c55e',
                      border: 'none',
                      color: '#fff',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleApprovalAction(appr.id, false)}
                    style={{
                      padding: '0.45rem 0.9rem',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', gap: '1rem' }}>
        <button
          onClick={() => setActiveTab('jobs')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'jobs' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'jobs' ? '#38bdf8' : '#94a3b8',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Automations ({jobs.length})
        </button>

        <button
          onClick={() => setActiveTab('runs')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'runs' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'runs' ? '#38bdf8' : '#94a3b8',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Run History ({runs.length})
        </button>

        <button
          onClick={() => setActiveTab('notifications')}
          style={{
            padding: '0.6rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'notifications' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'notifications' ? '#38bdf8' : '#94a3b8',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          System Notifications ({notifications.length})
        </button>
      </div>

      {/* Jobs Tab Content */}
      {activeTab === 'jobs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {jobs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              No automation jobs configured. Click &ldquo;+ Create Automation&rdquo; to schedule your first background task.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              {jobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>{job.name}</span>
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background:
                            job.status === 'SCHEDULED'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : job.status === 'RUNNING'
                              ? 'rgba(59, 130, 246, 0.2)'
                              : job.status === 'PAUSED'
                              ? 'rgba(234, 179, 8, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                          color:
                            job.status === 'SCHEDULED'
                              ? '#4ade80'
                              : job.status === 'RUNNING'
                              ? '#60a5fa'
                              : job.status === 'PAUSED'
                              ? '#facc15'
                              : '#f87171',
                        }}
                      >
                        {job.status}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                      {job.description || `Task: ${job.taskType} • Schedule: ${job.type} (${job.schedule})`}
                    </p>

                    <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.2rem', fontSize: '0.75rem', color: '#64748b' }}>
                      <span>Next run: {job.nextRunAt ? new Date(job.nextRunAt).toLocaleTimeString() : 'N/A'}</span>
                      <span>Last run: {job.lastRunAt ? new Date(job.lastRunAt).toLocaleTimeString() : 'Never'}</span>
                      {job.failureCount > 0 && <span style={{ color: '#f87171' }}>Failures: {job.failureCount}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={() => handleRunNow(job.id)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ▶ Run Now
                    </button>

                    <button
                      onClick={() => handlePauseResume(job)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#e2e8f0',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {job.status === 'PAUSED' ? 'Resume' : 'Pause'}
                    </button>

                    <button
                      onClick={() => handleCancel(job.id)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#fca5a5',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Runs Tab Content */}
      {activeTab === 'runs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {runs.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              No execution runs logged yet. Runs appear automatically when automations execute.
            </div>
          ) : (
            runs.map((r) => (
              <div
                key={r.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>Run {r.id.slice(0, 8)}...</span>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background:
                          r.status === 'COMPLETED'
                            ? 'rgba(34, 197, 94, 0.2)'
                            : r.status === 'WAITING_FOR_APPROVAL'
                            ? 'rgba(234, 179, 8, 0.2)'
                            : 'rgba(239, 68, 68, 0.2)',
                        color:
                          r.status === 'COMPLETED'
                            ? '#4ade80'
                            : r.status === 'WAITING_FOR_APPROVAL'
                            ? '#facc15'
                            : '#f87171',
                      }}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Started: {new Date(r.startedAt).toLocaleString()} • Completed:{' '}
                    {r.completedAt ? new Date(r.completedAt).toLocaleTimeString() : 'In Progress'}
                  </div>
                  {r.error && <div style={{ fontSize: '0.78rem', color: '#f87171', marginTop: '0.25rem' }}>Error: {r.error}</div>}
                </div>

                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{r.steps?.length || 0} trace steps</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Notifications Tab Content */}
      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>No system notifications recorded.</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  background: n.read ? 'rgba(15, 23, 42, 0.4)' : 'rgba(30, 41, 59, 0.7)',
                  border: `1px solid ${n.read ? 'rgba(255, 255, 255, 0.05)' : 'rgba(56, 189, 248, 0.2)'}`,
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>{n.title}</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{new Date(n.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.83rem', color: '#cbd5e1' }}>{n.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Automation Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '2rem',
              width: '100%',
              maxWidth: '520px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Create Background Automation
            </h2>

            <form onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                  Automation Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Daily Next.js Job Scanner"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                  Task Category
                </label>
                <select
                  value={newJobTaskType}
                  onChange={(e) => setNewJobTaskType(e.target.value as TaskType)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    outline: 'none',
                  }}
                >
                  <option value="opportunity_monitor">Opportunity Monitor (Public Job Search & Match)</option>
                  <option value="research_monitor">Research Monitor (Live Web Intelligence & Summaries)</option>
                  <option value="workflow_monitor">Workflow Monitor (Career Checkpoints & Status)</option>
                  <option value="personal_summary">Personal Summary (Daily Digest of Opportunities & Workflows)</option>
                  <option value="custom">Custom Safe Assistant Task</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                  Search Query / Target Focus
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. React Next.js or AI Systems"
                  value={newJobQuery}
                  onChange={(e) => setNewJobQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                    Schedule Type
                  </label>
                  <select
                    value={newJobType}
                    onChange={(e) => setNewJobType(e.target.value as JobType)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      outline: 'none',
                    }}
                  >
                    <option value="interval">Interval (Milliseconds)</option>
                    <option value="cron">Cron Schedule</option>
                    <option value="once">Once</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>
                    Schedule (min 10s)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={newJobType === 'interval' ? '60000' : '0 9 * * *'}
                    value={newJobSchedule}
                    onChange={(e) => setNewJobSchedule(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    background: '#6366f1',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
