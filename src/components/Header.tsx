'use client';

import React from 'react';
import { ProviderId, ProviderInfo } from '@/lib/ai/types';
import { BrainIcon, SparklesIcon } from './Icons';

export type ActiveView =
  | 'assistant'
  | 'opportunities'
  | 'career'
  | 'knowledge'
  | 'computer'
  | 'voice'
  | 'automation'
  | 'activity'
  | 'settings'
  // Preserved for backwards compatibility
  | 'chat'
  | 'workflows'
  | 'tracker'
  | 'skill_gap'
  | 'mock_interview'
  | 'analytics';

interface HeaderProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  selectedProvider: ProviderId;
  onSelectProvider: (provider: ProviderId) => void;
  providers: ProviderInfo[];
  activeProviderUsed?: ProviderId;
  toggleProfileDrawer: () => void;
  isProfileOpen: boolean;
  unreadAlertsCount?: number;
}

export function Header({
  activeView,
  onSelectView,
  selectedProvider,
  onSelectProvider,
  providers,
  activeProviderUsed,
  toggleProfileDrawer,
  isProfileOpen,
  unreadAlertsCount = 0,
}: HeaderProps) {
  const currentInfo = providers.find((p) => p.id === selectedProvider) || {
    id: selectedProvider,
    name: selectedProvider.toUpperCase(),
    contextWindow: 'Context',
    configured: true,
  };

  // The 9 canonical product navigation areas for Farhan AI v1.0
  const navItems: { id: ActiveView; label: string; icon: string }[] = [
    { id: 'assistant', label: 'Assistant', icon: '✨' },
    { id: 'opportunities', label: 'Opportunities', icon: '🎯' },
    { id: 'career', label: 'Career', icon: '💼' },
    { id: 'knowledge', label: 'Knowledge', icon: '📚' },
    { id: 'computer', label: 'Computer', icon: '🖥️' },
    { id: 'voice', label: 'Voice', icon: '🎙️' },
    { id: 'automation', label: 'Automation', icon: '⚡' },
    { id: 'activity', label: 'Activity', icon: '📜' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  // Map legacy view names to active tab
  const getIsActive = (itemId: ActiveView): boolean => {
    if (activeView === itemId) return true;
    if (itemId === 'assistant' && activeView === 'chat') return true;
    if (
      itemId === 'career' &&
      (activeView === 'workflows' ||
        activeView === 'tracker' ||
        activeView === 'skill_gap' ||
        activeView === 'mock_interview' ||
        activeView === 'analytics')
    ) {
      return true;
    }
    return false;
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.65rem 1.5rem',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(10, 14, 23, 0.95)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Left: Brand Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'var(--gradient-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          <BrainIcon className="w-5 h-5" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.05rem', fontWeight: '700', letterSpacing: '-0.02em', color: '#fff' }}>
              Farhan AI
            </h1>
            <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '2px 7px' }}>
              v1.0
            </span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            Personal Career Operating System
          </p>
        </div>
      </div>

      {/* Center: Unified 9-Area Navigation */}
      <nav
        style={{
          display: 'flex',
          gap: '3px',
          background: 'var(--bg-main)',
          padding: '3px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {navItems.map((item) => {
          const isActive = getIsActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: isActive ? '600' : '400',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span style={{ fontSize: '0.82rem' }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'opportunities' && unreadAlertsCount > 0 && (
                <span
                  style={{
                    background: 'var(--color-primary)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    fontSize: '0.65rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                  }}
                >
                  {unreadAlertsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right Controls: Provider Picker & Profile Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {activeProviderUsed && activeProviderUsed !== selectedProvider && (
          <div className="badge badge-warning" style={{ fontSize: '0.68rem' }}>
            <span>Failover: {activeProviderUsed.toUpperCase()}</span>
          </div>
        )}

        {/* Model Selector */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <select
            value={selectedProvider}
            onChange={(e) => onSelectProvider(e.target.value as ProviderId)}
            style={{
              background: 'var(--bg-surface-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '5px 10px 5px 24px',
              fontSize: '0.75rem',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'auto',
            }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.configured ? '✓' : '(No Key)'}
              </option>
            ))}
          </select>
          <span
            style={{
              position: 'absolute',
              left: '9px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: currentInfo.configured ? '#10b981' : '#f59e0b',
              boxShadow: currentInfo.configured ? '0 0 6px #10b981' : 'none',
            }}
          />
        </div>

        {/* Toggle Profile Drawer */}
        <button
          onClick={toggleProfileDrawer}
          className={`btn ${isProfileOpen ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '5px 11px', fontSize: '0.75rem' }}
        >
          <SparklesIcon />
          <span>{isProfileOpen ? 'Hide Profile' : 'Profile'}</span>
        </button>
      </div>
    </header>
  );
}
