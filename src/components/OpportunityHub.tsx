'use client';

import React, { useState, useEffect } from 'react';
import { OpportunityItem } from '@/types/tools';
import { executeDiscoverOpportunities } from '@/lib/tools/client';
import { SparklesIcon, BriefcaseIcon, ShieldCheckIcon } from './Icons';

interface OpportunityHubProps {
  onDraftProposal: (opp: OpportunityItem) => void;
  onAnalyzeGap: (role: string) => void;
  onSaveToTracker: (opp: OpportunityItem) => void;
}

export function OpportunityHub({ onDraftProposal, onAnalyzeGap, onSaveToTracker }: OpportunityHubProps) {
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [search, setSearch] = useState('');
  const [workModel, setWorkModel] = useState<'all' | 'remote'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await executeDiscoverOpportunities({
        query: search || undefined,
        workModel: workModel === 'all' ? undefined : workModel,
      });
      if (res.success && res.data) {
        setOpportunities((res.data as any).opportunities || []);
      }
      setLoading(false);
    }
    load();
  }, [search, workModel]);

  return (
    <div style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#fff' }}>
            Opportunity Discovery & Matching
          </h2>
          <span className="badge badge-primary">Stage 2 Tool</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Autonomous discovery engine ranking tech opportunities based on Farhan\'s verified skills, remote preference, and career goals.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '1.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Search by title, technology, or company (e.g. AI, Next.js, Architecture)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: '260px',
            padding: '8px 14px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            color: '#fff',
            fontSize: '0.85rem',
          }}
        />

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setWorkModel('all')}
            className={`btn ${workModel === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            All Work Models
          </button>
          <button
            onClick={() => setWorkModel('remote')}
            className={`btn ${workModel === 'remote' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            Remote Only (Preferred)
          </button>
        </div>
      </div>

      {/* Opportunities Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.25rem' }}>
        {opportunities.map((opp) => (
          <div
            key={opp.id}
            className="glass-panel animate-fade-in"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'border-color 0.2s ease, transform 0.2s ease',
            }}
          >
            <div>
              {/* Card Header: Role & Match Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff' }}>
                    {opp.title}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: '500', marginTop: '2px' }}>
                    {opp.company} • {opp.location}
                  </p>
                </div>
                <div
                  className="badge"
                  style={{
                    background: opp.matchScore >= 90 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                    color: opp.matchScore >= 90 ? '#6ee7b7' : '#a5b4fc',
                    border: `1px solid ${opp.matchScore >= 90 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                    fontWeight: '700',
                  }}
                >
                  {opp.matchScore}% Match
                </div>
              </div>

              {opp.salaryRange && (
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-amber)', marginTop: '8px', fontWeight: '500' }}>
                  💰 {opp.salaryRange}
                </div>
              )}

              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '10px 0', lineHeight: '1.5' }}>
                {opp.description}
              </p>

              {/* Match Reason Banner */}
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 10px',
                  fontSize: '0.75rem',
                  color: '#c7d2fe',
                  marginBottom: '12px',
                }}
              >
                <strong>Match Analysis:</strong> {opp.matchReason}
              </div>

              {/* Required Skills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '1rem' }}>
                {opp.requiredSkills.map((s) => (
                  <span
                    key={s}
                    style={{
                      fontSize: '0.7rem',
                      background: 'var(--bg-surface-elevated)',
                      color: 'var(--text-primary)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
                marginTop: '8px',
              }}
            >
              <button
                onClick={() => onDraftProposal(opp)}
                className="btn btn-primary"
                style={{ flex: 1, padding: '6px 12px', fontSize: '0.78rem' }}
              >
                <SparklesIcon />
                <span>Draft Proposal</span>
              </button>

              <button
                onClick={() => onAnalyzeGap(opp.title)}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                <span>Skill Gap</span>
              </button>

              <button
                onClick={() => onSaveToTracker(opp)}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                title="Save to Application Tracker"
              >
                <BriefcaseIcon />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
