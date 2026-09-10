'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Workflow, WorkflowStep } from '@/lib/workflows/types';
import { WorkflowIcon, SparklesIcon, ShieldCheckIcon } from './Icons';

export function CareerWorkflowsView() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [selectedLaunchType, setSelectedLaunchType] = useState<
    'career_discovery' | 'opportunity_analysis' | 'application_preparation'
  >('career_discovery');

  // Form states for launching
  const [discoveryQuery, setDiscoveryQuery] = useState('Senior Full Stack Engineer');
  const [discoveryLocation, setDiscoveryLocation] = useState('Remote');
  const [discoveryLimit, setDiscoveryLimit] = useState(3);

  const [analysisTitle, setAnalysisTitle] = useState('Senior Full Stack Engineer');
  const [analysisCompany, setAnalysisCompany] = useState('Vercel');
  const [analysisJD, setAnalysisJD] = useState(
    'We are seeking a Senior Full-Stack Engineer proficient in Next.js App Router, TypeScript, React Server Components, and PostgreSQL. Must have 5+ years building scalable cloud platforms and high-throughput APIs.'
  );

  const [appRole, setAppRole] = useState('Senior AI Systems Engineer');
  const [appCompany, setAppCompany] = useState('Scale AI');
  const [appJD, setAppJD] = useState(
    'Looking for a Senior AI Systems Engineer with deep TypeScript, LLM orchestration, vector search, and SQLite/PostgreSQL experience to lead autonomous agent architectures.'
  );

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/workflows?limit=50');
      const data = await res.json();
      if (res.ok && data.workflows) {
        setWorkflows(data.workflows);
        if (!selectedWorkflowId && data.workflows.length > 0) {
          setSelectedWorkflowId(data.workflows[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflowId]);

  useEffect(() => {
    fetchWorkflows();
    const interval = setInterval(fetchWorkflows, 4000);
    return () => clearInterval(interval);
  }, [fetchWorkflows]);

  const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId) || workflows[0];

  const handleLaunchWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      let input: Record<string, unknown> = {};
      if (selectedLaunchType === 'career_discovery') {
        input = {
          query: discoveryQuery,
          location: discoveryLocation,
          maxOpportunities: Number(discoveryLimit) || 3,
        };
      } else if (selectedLaunchType === 'opportunity_analysis') {
        input = {
          roleTitle: analysisTitle,
          companyName: analysisCompany,
          jobDescription: analysisJD,
        };
      } else if (selectedLaunchType === 'application_preparation') {
        input = {
          opportunity: {
            title: appRole,
            company: appCompany,
            description: appJD,
            location: 'Remote',
            workModel: 'remote',
            salaryRange: '$160,000 - $210,000',
          },
        };
      }

      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowType: selectedLaunchType,
          input,
        }),
      });

      const data = await res.json();
      if (res.ok && data.workflow) {
        setShowLaunchModal(false);
        await fetchWorkflows();
        setSelectedWorkflowId(data.workflow.id);
      } else {
        alert(`Error starting workflow: ${data.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Failed to launch workflow: ${msg}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (workflowId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.workflow) {
        await fetchWorkflows();
      } else {
        alert(`Failed to approve workflow: ${data.error}`);
      }
    } catch (err: unknown) {
      alert(`Approval error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (workflowId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/resume`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.workflow) {
        await fetchWorkflows();
      } else {
        alert(`Failed to resume workflow: ${data.error}`);
      }
    } catch (err: unknown) {
      alert(`Resume error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (workflowId: string) => {
    if (!confirm('Are you sure you want to cancel this workflow?')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.workflow) {
        await fetchWorkflows();
      } else {
        alert(`Failed to cancel workflow: ${data.error}`);
      }
    } catch (err: unknown) {
      alert(`Cancellation error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: Workflow['status'] | WorkflowStep['status']) => {
    switch (status) {
      case 'completed':
        return <span className="badge badge-success">Completed</span>;
      case 'running':
        return <span className="badge badge-primary animate-pulse">Running</span>;
      case 'waiting_for_approval':
        return (
          <span
            className="badge"
            style={{
              background: 'rgba(245, 158, 11, 0.2)',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.4)',
            }}
          >
            Approval Required
          </span>
        );
      case 'failed':
        return <span className="badge badge-danger">Failed</span>;
      case 'cancelled':
        return <span className="badge badge-neutral">Cancelled</span>;
      case 'pending':
      default:
        return <span className="badge badge-neutral">Pending</span>;
    }
  };

  return (
    <div style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '2rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#fff' }}>
              Autonomous Career Workflows
            </h2>
            <span className="badge badge-primary">Stage 4 Workflows</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Deterministic multi-step execution, SQLite state checkpointing, and strict human authorization boundaries.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={fetchWorkflows}
            disabled={actionLoading}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowLaunchModal(true)}
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <SparklesIcon />
            Launch Workflow
          </button>
        </div>
      </div>

      {/* Main Grid: Left Workflow List, Right Workflow Inspector */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          gap: '1.5rem',
          minHeight: '620px',
        }}
      >
        {/* Left: Workflow List */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>WORKFLOW HISTORY ({workflows.length})</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-syncing</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading workflows...
              </div>
            ) : workflows.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No workflows launched yet. Click &quot;Launch Workflow&quot; to begin.
              </div>
            ) : (
              workflows.map((wf) => {
                const isSelected = selectedWorkflow && selectedWorkflow.id === wf.id;
                const completedSteps = wf.steps.filter((s) => s.status === 'completed').length;
                const totalSteps = wf.steps.length;
                const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                return (
                  <div
                    key={wf.id}
                    onClick={() => setSelectedWorkflowId(wf.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      marginBottom: '6px',
                      cursor: 'pointer',
                      border: isSelected
                        ? '1px solid var(--primary)'
                        : '1px solid var(--border-subtle)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: '#fff',
                          textTransform: 'capitalize',
                        }}
                      >
                        {wf.type.replace(/_/g, ' ')}
                      </span>
                      {getStatusBadge(wf.status)}
                    </div>

                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>Steps: {completedSteps}/{totalSteps}</span>
                      <span>{new Date(wf.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Mini Progress Bar */}
                    <div
                      style={{
                        height: '4px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${progressPct}%`,
                          height: '100%',
                          background:
                            wf.status === 'failed'
                              ? '#ef4444'
                              : wf.status === 'waiting_for_approval'
                              ? '#fbbf24'
                              : 'var(--primary)',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Workflow Inspector */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {selectedWorkflow ? (
            <>
              {/* Detail Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.015)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff', textTransform: 'capitalize' }}>
                      {selectedWorkflow.type.replace(/_/g, ' ')}
                    </h3>
                    {getStatusBadge(selectedWorkflow.status)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ID: <code style={{ color: 'var(--text-secondary)' }}>{selectedWorkflow.id}</code> · Created:{' '}
                    {new Date(selectedWorkflow.createdAt).toLocaleString()}
                  </div>
                </div>

                {/* Workflow Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedWorkflow.status === 'waiting_for_approval' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleApprove(selectedWorkflow.id)}
                      disabled={actionLoading}
                      style={{
                        padding: '6px 14px',
                        fontSize: '0.8rem',
                        background: '#10b981',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ShieldCheckIcon />
                      Authorize & Resume
                    </button>
                  )}

                  {selectedWorkflow.status === 'failed' && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleResume(selectedWorkflow.id)}
                      disabled={actionLoading}
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      Retry Workflow
                    </button>
                  )}

                  {(selectedWorkflow.status === 'running' ||
                    selectedWorkflow.status === 'waiting_for_approval' ||
                    selectedWorkflow.status === 'pending') && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleCancel(selectedWorkflow.id)}
                      disabled={actionLoading}
                      style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#f87171' }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Waiting for Approval Alert Card */}
              {selectedWorkflow.status === 'waiting_for_approval' && (
                <div
                  style={{
                    margin: '16px 20px 0 20px',
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <div style={{ color: '#fbbf24', marginTop: '2px' }}>
                    <ShieldCheckIcon />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fbbf24', marginBottom: '4px' }}>
                      Human-in-the-Loop Approval Required
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      This workflow has generated a customized application proposal and is staged to mutate the career
                      database. System policy mandates explicit user review before persisting to the tracker.
                    </p>
                    {Boolean(selectedWorkflow.context?.proposal) && (
                      <div
                        style={{
                          background: 'rgba(0,0,0,0.3)',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          color: '#e2e8f0',
                          maxHeight: '120px',
                          overflowY: 'auto',
                          marginBottom: '10px',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {String(selectedWorkflow.context.proposal)}
                      </div>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={() => handleApprove(selectedWorkflow.id)}
                      disabled={actionLoading}
                      style={{ padding: '6px 14px', fontSize: '0.8rem', background: '#10b981', border: 'none' }}
                    >
                      Authorize & Submit to Tracker
                    </button>
                  </div>
                </div>
              )}

              {/* Failure Error Alert */}
              {selectedWorkflow.error && (
                <div
                  style={{
                    margin: '16px 20px 0 20px',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '0.85rem',
                  }}
                >
                  <strong>Execution Error:</strong>{' '}
                  {typeof selectedWorkflow.error === 'string'
                    ? selectedWorkflow.error
                    : (selectedWorkflow.error as any)?.message || JSON.stringify(selectedWorkflow.error)}
                </div>
              )}

              {/* Step Execution Timeline */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <h4
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Sequential Step Checkpoints
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedWorkflow.steps.map((step, idx) => {
                    const isStepRunning = step.status === 'running';
                    const isStepCompleted = step.status === 'completed';
                    const isStepWaiting = step.status === 'waiting_for_approval';
                    const isStepFailed = step.status === 'failed';

                    return (
                      <div
                        key={step.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: isStepWaiting
                            ? '1px solid rgba(245, 158, 11, 0.4)'
                            : isStepRunning
                            ? '1px solid var(--primary)'
                            : '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          padding: '14px 16px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '6px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: isStepCompleted
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : isStepRunning
                                  ? 'rgba(99, 102, 241, 0.2)'
                                  : isStepWaiting
                                  ? 'rgba(245, 158, 11, 0.2)'
                                  : 'rgba(255, 255, 255, 0.05)',
                                color: isStepCompleted
                                  ? '#10b981'
                                  : isStepRunning
                                  ? '#818cf8'
                                  : isStepWaiting
                                  ? '#fbbf24'
                                  : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              {idx + 1}
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                              {step.name}
                            </span>
                          </div>
                          {getStatusBadge(step.status)}
                        </div>

                        {step.error && (
                          <div
                            style={{
                              marginTop: '8px',
                              fontSize: '0.8rem',
                              color: '#f87171',
                              background: 'rgba(239, 68, 68, 0.08)',
                              padding: '8px 10px',
                              borderRadius: '6px',
                            }}
                          >
                            {step.error}
                          </div>
                        )}

                        {Boolean(step.output) && (
                          <details style={{ marginTop: '8px' }}>
                            <summary
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                userSelect: 'none',
                              }}
                            >
                              View Step Output Data
                            </summary>
                            <pre
                              style={{
                                marginTop: '6px',
                                background: 'rgba(0, 0, 0, 0.3)',
                                padding: '10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                overflowX: 'auto',
                                maxHeight: '180px',
                              }}
                            >
                              {JSON.stringify(step.output, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Synthesis / Final Output Highlights */}
                {Boolean(selectedWorkflow.context?.synthesis) && (
                  <div style={{ marginTop: '24px' }}>
                    <h4
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginBottom: '10px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Executive Synthesis & Strategic Recommendations
                    </h4>
                    <div
                      style={{
                        background: 'rgba(99, 102, 241, 0.05)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        borderRadius: '8px',
                        padding: '16px',
                        fontSize: '0.85rem',
                        color: '#e2e8f0',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {String(selectedWorkflow.context.synthesis)}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              Select a workflow from the left list to view step checkpoint telemetry.
            </div>
          )}
        </div>
      </div>

      {/* Launch Workflow Modal */}
      {showLaunchModal && (
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
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                Launch Autonomous Career Workflow
              </h3>
              <button
                onClick={() => setShowLaunchModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {/* Workflow Type Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '1.25rem' }}>
              {[
                { type: 'career_discovery', label: 'Career Discovery' },
                { type: 'opportunity_analysis', label: 'JD Analysis' },
                { type: 'application_preparation', label: 'App Pipeline' },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setSelectedLaunchType(item.type as any)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border:
                      selectedLaunchType === item.type
                        ? '1px solid var(--primary)'
                        : '1px solid var(--border-subtle)',
                    background:
                      selectedLaunchType === item.type
                        ? 'rgba(99, 102, 241, 0.2)'
                        : 'rgba(255, 255, 255, 0.03)',
                    color: selectedLaunchType === item.type ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Dynamic Form */}
            <form onSubmit={handleLaunchWorkflow}>
              {selectedLaunchType === 'career_discovery' && (
                <>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Target Role / Domain Query
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={discoveryQuery}
                      onChange={(e) => setDiscoveryQuery(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Location / Work Model
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={discoveryLocation}
                        onChange={(e) => setDiscoveryLocation(e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Max Results to Research
                      </label>
                      <input
                        type="number"
                        className="input"
                        value={discoveryLimit}
                        onChange={(e) => setDiscoveryLimit(parseInt(e.target.value, 10) || 3)}
                        min={1}
                        max={10}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </>
              )}

              {selectedLaunchType === 'opportunity_analysis' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Role Title
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={analysisTitle}
                        onChange={(e) => setAnalysisTitle(e.target.value)}
                        required
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Company Name
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={analysisCompany}
                        onChange={(e) => setAnalysisCompany(e.target.value)}
                        required
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Job Description Text
                    </label>
                    <textarea
                      className="input"
                      rows={4}
                      value={analysisJD}
                      onChange={(e) => setAnalysisJD(e.target.value)}
                      required
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>
                </>
              )}

              {selectedLaunchType === 'application_preparation' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Role Title
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={appRole}
                        onChange={(e) => setAppRole(e.target.value)}
                        required
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Company Name
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={appCompany}
                        onChange={(e) => setAppCompany(e.target.value)}
                        required
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Job Description
                    </label>
                    <textarea
                      className="input"
                      rows={4}
                      value={appJD}
                      onChange={(e) => setAppJD(e.target.value)}
                      required
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '12px' }}>
                    ⚠️ This workflow will pause before persisting to the tracker to require your explicit authorization.
                  </p>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowLaunchModal(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Starting...' : 'Start Execution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
