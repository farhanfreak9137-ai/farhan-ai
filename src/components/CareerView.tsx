'use client';

import React, { useState, useEffect } from 'react';
import { CareerWorkflowsView } from './CareerWorkflowsView';
import { ApplicationTrackerView } from './ApplicationTrackerView';
import { SkillGapStudio } from './SkillGapStudio';
import { MockInterviewRoom } from './MockInterviewRoom';
import { CareerAnalyticsView } from './CareerAnalyticsView';
import { WorkflowIcon, BriefcaseIcon, SparklesIcon } from './Icons';

export type CareerSubView = 'workflows' | 'tracker' | 'skill_gap' | 'mock_interview' | 'analytics';

interface CareerViewProps {
  initialSubView?: CareerSubView;
  selectedGapRole?: string;
  onNavigateToAssistant?: () => void;
}

export function CareerView({
  initialSubView = 'workflows',
  selectedGapRole = 'Senior AI Systems Engineer',
  onNavigateToAssistant,
}: CareerViewProps) {
  const [subView, setSubView] = useState<CareerSubView>(initialSubView);

  useEffect(() => {
    if (initialSubView) {
      setSubView(initialSubView);
    }
  }, [initialSubView]);

  const subTabs: { id: CareerSubView; label: string; icon: string }[] = [
    { id: 'workflows', label: 'Autonomous Workflows', icon: '⚡' },
    { id: 'tracker', label: 'Application Pipeline', icon: '📋' },
    { id: 'skill_gap', label: 'Skill Gap Studio', icon: '🎯' },
    { id: 'mock_interview', label: 'Interview Prep Room', icon: '🎙️' },
    { id: 'analytics', label: 'Career Analytics', icon: '📊' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Sub-navigation Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(15, 23, 42, 0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>Career Command Center</h2>
          <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>
            Workflows & Pipeline
          </span>
        </div>

        {/* Sub-Tabs Pills */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--bg-main)',
            padding: '3px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {subTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubView(tab.id)}
              style={{
                padding: '5px 14px',
                fontSize: '0.75rem',
                fontWeight: subView === tab.id ? '600' : '400',
                color: subView === tab.id ? '#fff' : 'var(--text-secondary)',
                background: subView === tab.id ? 'var(--bg-surface-elevated)' : 'transparent',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sub-View Content: Reuses Existing Production Components */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {subView === 'workflows' && <CareerWorkflowsView />}
        {subView === 'tracker' && <ApplicationTrackerView />}
        {subView === 'skill_gap' && <SkillGapStudio initialRole={selectedGapRole} />}
        {subView === 'mock_interview' && <MockInterviewRoom />}
        {subView === 'analytics' && <CareerAnalyticsView />}
      </div>
    </div>
  );
}
