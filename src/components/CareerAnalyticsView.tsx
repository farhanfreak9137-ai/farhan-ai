'use client';

import React, { useState, useEffect } from 'react';
import { ApplicationItem } from '@/types/tracker';
import { UserProfile } from '@/types/profile';
import { defaultProfile } from '@/data/defaultProfile';
import { BarChartIcon, ShieldCheckIcon, SparklesIcon } from './Icons';

export function CareerAnalyticsView() {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [pRes, aRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/applications'),
        ]);
        if (pRes.ok) setProfile(await pRes.json());
        if (aRes.ok) {
          const aData = await aRes.json();
          setApplications(aData.applications || []);
        }
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute Funnel Metrics
  const totalApps = applications.length || 1;
  const savedCount = applications.filter((a) => a.status === 'saved').length;
  const appliedCount = applications.filter((a) => a.status === 'applied').length;
  const interviewingCount = applications.filter((a) => a.status === 'interviewing').length;
  const offerCount = applications.filter((a) => a.status === 'offer').length;

  const averageMatchScore = applications.length
    ? Math.round(applications.reduce((acc, a) => acc + a.matchScore, 0) / applications.length)
    : 92;

  const totalVerifiedSkills = profile.skills.reduce((acc, c) => acc + c.skills.length, 0);

  return (
    <div style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#fff' }}>
            Career Analytics & Intelligence
          </h2>
          <span className="badge badge-primary">Stage 3 Intelligence</span>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Real-time metrics measuring market readiness, recruitment funnel velocity, and compensation potential.
        </p>
      </div>

      {/* Top 4 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* KPI 1: Readiness Score */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Market Readiness Index
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#6ee7b7', margin: '6px 0' }}>
            {averageMatchScore}%
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Based on active role alignment
          </p>
        </div>

        {/* KPI 2: Verified Competencies */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Verified Competencies
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#a5b4fc', margin: '6px 0' }}>
            {totalVerifiedSkills}
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Across 4 specialized domains
          </p>
        </div>

        {/* KPI 3: Active Funnel Velocity */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Pipeline Conversion Rate
          </span>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#38bdf8', margin: '6px 0' }}>
            {Math.round(((interviewingCount + offerCount) / totalApps) * 100)}%
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Applied to Interview conversion
          </p>
        </div>

        {/* KPI 4: Target Compensation Band */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Target Compensation
          </span>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fcd34d', margin: '10px 0 6px 0' }}>
            $145k - $210k
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Senior/Staff AI Engineering Band
          </p>
        </div>
      </div>

      {/* Charts / Funnel Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Recruitment Funnel Visualizer */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff', marginBottom: '1.25rem' }}>
            Recruitment Funnel Velocity
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: 'Saved / Researching', count: savedCount, color: '#94a3b8' },
              { label: 'Applied', count: appliedCount, color: '#6366f1' },
              { label: 'Interviewing', count: interviewingCount, color: '#06b6d4' },
              { label: 'Offer Received', count: offerCount, color: '#10b981' },
            ].map((stage) => {
              const pct = Math.max(8, Math.round((stage.count / totalApps) * 100));
              return (
                <div key={stage.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span style={{ color: '#fff', fontWeight: '500' }}>{stage.label}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{stage.count} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: 'var(--bg-main)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: stage.color,
                        borderRadius: '999px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top In-Demand Skills Ranking */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff', marginBottom: '1.25rem' }}>
            High-Impact Tech Stack Demand
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { skill: 'TypeScript & Next.js App Router', demand: '98% Market Demand', status: 'Farhan: Expert' },
              { skill: 'LLM Orchestration & Prompting', demand: '95% Market Demand', status: 'Farhan: Advanced' },
              { skill: 'Function & Tool Calling', demand: '92% Market Demand', status: 'Farhan: Advanced' },
              { skill: 'PostgreSQL & Real-Time SSE', demand: '88% Market Demand', status: 'Farhan: Advanced' },
              { skill: 'Multi-Model Fallbacks & Routing', demand: '85% Market Demand', status: 'Farhan: Advanced' },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-surface-elevated)',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <strong style={{ color: '#fff' }}>{item.skill}</strong>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>
                    {item.status}
                  </span>
                </div>
                <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>
                  {item.demand}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
