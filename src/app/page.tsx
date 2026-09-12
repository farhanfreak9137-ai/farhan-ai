'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile } from '@/types/profile';
import { ProviderId, ProviderInfo, ToolCall } from '@/lib/ai/types';
import { defaultProfile } from '@/data/defaultProfile';
import { Header, ActiveView } from '@/components/Header';
import { ProfilePanel } from '@/components/ProfilePanel';
import { ChatInterface } from '@/components/ChatInterface';
import { OpportunityHub } from '@/components/OpportunityHub';
import { CareerView, CareerSubView } from '@/components/CareerView';
import { PersonalKnowledgeView } from '@/components/PersonalKnowledgeView';
import { ComputerDashboard } from '@/components/ComputerDashboard';
import { VoiceStudio } from '@/components/voice/VoiceStudio';
import { AutomationDashboard } from '@/components/automation/AutomationDashboard';
import { ActivityAuditView } from '@/components/ActivityAuditView';
import { SettingsSystemView } from '@/components/SettingsSystemView';
import { HumanApprovalModal } from '@/components/HumanApprovalModal';
import { OpportunityItem, ToolExecutionResult } from '@/types/tools';
import { executeGenerateProposal } from '@/lib/tools/client';
import type { MonitoredAlert } from '@/lib/scanner/monitor';

export default function Home() {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [activeView, setActiveView] = useState<ActiveView>('assistant');
  const [careerSubView, setCareerSubView] = useState<CareerSubView>('workflows');
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('ollama');
  const [activeProviderUsed, setActiveProviderUsed] = useState<ProviderId | undefined>();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedGapRole, setSelectedGapRole] = useState('Senior AI Systems Engineer');

  // Scheduled Opportunity Monitor alerts
  const [alerts, setAlerts] = useState<MonitoredAlert[]>([]);
  const [activeBannerAlert, setActiveBannerAlert] = useState<MonitoredAlert | null>(null);

  // Human approval modal state
  type ApprovalPayload = NonNullable<ToolExecutionResult['approvalPayload']>;
  const [approvalRequest, setApprovalRequest] = useState<ApprovalPayload | null>(null);
  const [pendingToolCall, setPendingToolCall] = useState<ToolCall | null>(null);

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, providersRes, monitorRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/providers'),
          fetch('/api/monitor'),
        ]);

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setProfile(profileData);
        }

        if (providersRes.ok) {
          const providersData = await providersRes.json();
          if (providersData.providers) {
            setProviders(providersData.providers);
            // Prioritize primary cloud AI providers (Gemini / Groq / OpenAI) with 0% local CPU load
            const preferred = providersData.providers.find(
              (p: ProviderInfo) => (p.id === 'gemini' || p.id === 'groq' || p.id === 'openai') && p.configured
            );
            if (preferred) {
              setSelectedProvider(preferred.id);
            } else {
              const firstConfigured = providersData.providers.find(
                (p: ProviderInfo) => p.configured && p.id !== 'mock'
              );
              if (firstConfigured) {
                setSelectedProvider(firstConfigured.id);
              }
            }
          }
        }

        if (monitorRes.ok) {
          const mData = await monitorRes.json();
          if (mData.alerts && mData.alerts.length > 0) {
            setAlerts(mData.alerts);
            const newAlert = mData.alerts.find((a: MonitoredAlert) => a.status === 'new');
            if (newAlert) setActiveBannerAlert(newAlert);
          }
        }
      } catch (err) {
        console.warn('Initial data load error:', err);
      }
    }

    loadData();

    // Check for ?voice=true or ?autostart=true query parameter to route directly to Voice/Jarvis
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('voice') === 'true' || params.get('autostart') === 'true') {
        setActiveView('voice');
      }
    }
  }, []);

  // Global hotkey: Alt+J to instantly summon Jarvis Voice from any view
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleGlobalKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (e.altKey && (e.key === 'j' || e.key === 'J') && !isInput) {
        e.preventDefault();
        setActiveView('voice');
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const handleSelectView = (view: ActiveView) => {
    if (view === 'workflows' || view === 'tracker' || view === 'skill_gap' || view === 'mock_interview' || view === 'analytics') {
      setCareerSubView(view as CareerSubView);
      setActiveView('career');
    } else if (view === 'chat') {
      setActiveView('assistant');
    } else {
      setActiveView(view);
    }
  };

  const handleDraftProposal = async (opp: OpportunityItem) => {
    const res = await executeGenerateProposal({
      companyName: opp.company,
      roleTitle: opp.title,
    });

    if (res.requiresHumanApproval && res.approvalPayload) {
      setApprovalRequest(res.approvalPayload);
    }
  };

  const handleAnalyzeGapFromOpp = (role: string) => {
    setSelectedGapRole(role);
    setCareerSubView('skill_gap');
    setActiveView('career');
  };

  const handleSaveToTracker = async (opp: OpportunityItem) => {
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          application: {
            company: opp.company,
            role: opp.title,
            location: opp.location,
            workModel: opp.workModel,
            status: 'saved',
            matchScore: opp.matchScore,
            salaryRange: opp.salaryRange,
            notes: `Saved from Opportunity Discovery. Match: ${opp.matchReason}`,
          },
        }),
      });

      if (res.ok) {
        showToast(`Saved ${opp.title} at ${opp.company} to your Application Pipeline!`);
      }
    } catch (err) {
      console.error('Failed to save to tracker:', err);
    }
  };

  const handleApproveAction = async () => {
    if (!approvalRequest) return;

    if (pendingToolCall) {
      try {
        const res = await fetch('/api/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: `Execute authorized action: ${approvalRequest.title}` }],
            provider: selectedProvider,
            action: 'approve_action',
            toolCall: pendingToolCall,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          showToast(data.answer || `Authorized action completed: ${approvalRequest.title}`);
        } else {
          showToast(`Action execution failed: server error`);
        }
      } catch (err) {
        showToast('Failed to execute approved action');
      }
      setPendingToolCall(null);
    } else if (approvalRequest.actionType === 'export_proposal') {
      const payload = approvalRequest.payload as any;
      await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          application: {
            company: payload.company,
            role: payload.role,
            location: 'Remote',
            workModel: 'remote',
            status: 'applied',
            matchScore: 95,
            notes: 'Proposal approved and logged in tracker.',
            proposalDraft: payload.content,
          },
        }),
      });
      showToast(`Proposal approved for ${payload.company}! Logged into your Application Pipeline.`);
    }

    setApprovalRequest(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)' }}>
      {/* Top Header with 9 Unified Areas */}
      <Header
        activeView={activeView}
        onSelectView={handleSelectView}
        selectedProvider={selectedProvider}
        onSelectProvider={setSelectedProvider}
        providers={providers}
        activeProviderUsed={activeProviderUsed}
        toggleProfileDrawer={() => setIsProfileOpen(!isProfileOpen)}
        isProfileOpen={isProfileOpen}
        unreadAlertsCount={alerts.filter((a) => a.status === 'new').length}
      />

      {/* Scheduled Opportunity Monitor Alert Banner */}
      {activeBannerAlert && (
        <div
          className="animate-fade-in"
          style={{
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.25) 0%, rgba(6, 182, 212, 0.25) 100%)',
            borderBottom: '1px solid rgba(99, 102, 241, 0.4)',
            padding: '8px 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: '#fff',
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.9rem' }}>⚡</span>
            <span>
              <strong>Opportunity Watcher Detected High Match:</strong>{' '}
              {activeBannerAlert.opportunity.title} at {activeBannerAlert.opportunity.company} ({activeBannerAlert.opportunity.matchScore}% Match)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                setActiveView('opportunities');
                setActiveBannerAlert(null);
              }}
              className="btn btn-primary"
              style={{ padding: '3px 10px', fontSize: '0.72rem' }}
            >
              View In Opportunities
            </button>
            <button
              onClick={() => setActiveBannerAlert(null)}
              className="btn btn-ghost"
              style={{ padding: '3px 8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className="badge badge-success animate-fade-in"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '10px 18px',
            fontSize: '0.85rem',
            zIndex: 90,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          ✓ {toastMessage}
        </div>
      )}

      {/* Main Dual-Pane Workspace */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: isProfileOpen ? '380px 1fr' : '1fr',
          height: activeBannerAlert ? 'calc(100vh - 105px)' : 'calc(100vh - 65px)',
          overflow: 'hidden',
          transition: 'grid-template-columns 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Left: Collapsible Structured Profile */}
        {isProfileOpen && (
          <ProfilePanel
            profile={profile}
            onDocumentAdded={(updated) => setProfile(updated)}
          />
        )}

        {/* Center / Right: The 9 Unified Product Views */}
        <div style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {(activeView === 'assistant' || activeView === 'chat') && (
            <ChatInterface
              selectedProvider={selectedProvider}
              onProviderUsedUpdate={setActiveProviderUsed}
              onRequestApproval={(req, toolCall) => {
                setApprovalRequest(req);
                setPendingToolCall(toolCall || null);
              }}
            />
          )}

          {activeView === 'opportunities' && (
            <OpportunityHub
              onDraftProposal={handleDraftProposal}
              onAnalyzeGap={handleAnalyzeGapFromOpp}
              onSaveToTracker={handleSaveToTracker}
            />
          )}

          {(activeView === 'career' || activeView === 'workflows' || activeView === 'tracker' || activeView === 'skill_gap' || activeView === 'mock_interview' || activeView === 'analytics') && (
            <CareerView
              initialSubView={careerSubView}
              selectedGapRole={selectedGapRole}
              onNavigateToAssistant={() => setActiveView('assistant')}
            />
          )}

          {activeView === 'knowledge' && (
            <PersonalKnowledgeView />
          )}

          {activeView === 'computer' && (
            <ComputerDashboard />
          )}

          {activeView === 'voice' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <VoiceStudio />
            </div>
          )}

          {activeView === 'automation' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <AutomationDashboard />
            </div>
          )}

          {activeView === 'activity' && (
            <ActivityAuditView />
          )}

          {activeView === 'settings' && (
            <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
              <SettingsSystemView />
            </div>
          )}
        </div>
      </main>

      {/* Human-in-the-loop Approval Modal */}
      {approvalRequest && (
        <HumanApprovalModal
          request={approvalRequest}
          onApprove={handleApproveAction}
          onReject={() => setApprovalRequest(null)}
        />
      )}
    </div>
  );
}
