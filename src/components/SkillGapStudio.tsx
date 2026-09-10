'use client';

import React, { useState } from 'react';
import { executeAnalyzeSkillGap } from '@/lib/tools/client';
import { SkillGapResult } from '@/types/tools';
import { SparklesIcon, ShieldCheckIcon } from './Icons';

interface SkillGapStudioProps {
  initialRole?: string;
}

export function SkillGapStudio({ initialRole = 'Senior AI Systems Engineer' }: SkillGapStudioProps) {
  const [targetRole, setTargetRole] = useState(initialRole);
  const [jobText, setJobText] = useState('');
  const [result, setResult] = useState<SkillGapResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!targetRole.trim()) return;
    setLoading(true);

    const res = await executeAnalyzeSkillGap({
      targetRole,
      jobDescriptionText: jobText || undefined,
    });

    if (res.success && res.data) {
      setResult(res.data as SkillGapResult);
    }
    setLoading(false);
  };

  return (
    <div style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#fff' }}>
            Skill-Gap Analysis Studio
          </h2>
          <span className="badge badge-primary">Stage 2 Tool</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Compare Farhan\'s verified competencies against any target role or job description. Computes exact match percentages and actionable learning roadmaps.
        </p>
      </div>

      {/* Input Section */}
      <div
        className="glass-panel"
        style={{
          padding: '1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            Target Role Title
          </label>
          <input
            type="text"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. AI Systems Architect, Senior Full-Stack Engineer, Staff ML Engineer"
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: '#fff',
              fontSize: '0.85rem',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            Paste Job Description (Optional — for deep extraction)
          </label>
          <textarea
            rows={4}
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Paste complete job description requirements here..."
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: '#fff',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-mono)',
              resize: 'vertical',
            }}
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !targetRole.trim()}
          className="btn btn-primary"
          style={{ alignSelf: 'flex-start', padding: '8px 20px', fontSize: '0.85rem' }}
        >
          <SparklesIcon />
          <span>{loading ? 'Evaluating Alignment...' : 'Run Skill-Gap Analysis'}</span>
        </button>
      </div>

      {/* Results Section */}
      {result && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Score Banner */}
          <div
            className="glass-panel"
            style={{
              padding: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderLeft: '4px solid var(--accent-primary)',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#fff' }}>
                {result.targetRole} Alignment
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {result.strengthsSummary}
              </p>
            </div>
            <div
              style={{
                width: '85px',
                height: '85px',
                borderRadius: '50%',
                background: 'var(--gradient-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-glow)',
                color: '#fff',
                fontSize: '1.4rem',
                fontWeight: '800',
              }}
            >
              {result.overallMatchScore}%
            </div>
          </div>

          {/* Side by side: Verified Strengths vs Gaps */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Verified Matches */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <ShieldCheckIcon />
                <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#6ee7b7' }}>
                  Verified Strengths & Matches ({result.verifiedMatches.length})
                </h4>
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '1.2rem', fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                {result.verifiedMatches.map((m, idx) => (
                  <li key={idx}>{m}</li>
                ))}
              </ul>
            </div>

            {/* Identified Gaps */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ color: '#f59e0b', fontSize: '1rem' }}>⚠</span>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fcd34d' }}>
                  Missing Competencies ({result.gapsOrMissingSkills.length})
                </h4>
              </div>
              {result.gapsOrMissingSkills.length === 0 ? (
                <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                  Zero skill gaps detected! Farhan satisfies all listed requirements.
                </p>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '1.2rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  {result.gapsOrMissingSkills.map((gap, idx) => (
                    <li key={idx}><strong>{gap}</strong> — Not in verified profile</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Actionable Learning Roadmap */}
          {result.learningRoadmap.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '12px' }}>
                🎯 Recommended Learning Roadmap to Close Gaps
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {result.learningRoadmap.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge ${item.priority === 'high' ? 'badge-warning' : 'badge-primary'}`}>
                          {item.priority.toUpperCase()} PRIORITY
                        </span>
                        <strong style={{ fontSize: '0.875rem', color: '#fff' }}>{item.skill}</strong>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {item.actionItem}
                      </p>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                      ⏱ {item.estimatedTime}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
