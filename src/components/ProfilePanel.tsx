'use client';

import React, { useState } from 'react';
import { UserProfile } from '@/types/profile';
import { BriefcaseIcon, FileTextIcon, ShieldCheckIcon, SparklesIcon } from './Icons';

interface ProfilePanelProps {
  profile: UserProfile;
  onDocumentAdded: (updatedProfile: UserProfile) => void;
}

export function ProfilePanel({ profile, onDocumentAdded }: ProfilePanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'experience' | 'projects' | 'documents'>('overview');
  
  // New Document Ingestion state
  const [isIngesting, setIsIngesting] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<'cv' | 'cover_letter' | 'project_spec' | 'note'>('cv');
  const [docContent, setDocContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docContent.trim()) return;

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addDocument',
          document: {
            title: docTitle,
            type: docType,
            content: docContent,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.profile) {
        onDocumentAdded(data.profile);
        setDocTitle('');
        setDocContent('');
        setIsIngesting(false);
        setStatusMessage('Document successfully ingested into Farhan AI knowledge base!');
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        setStatusMessage(data.error || 'Failed to ingest document');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error during ingestion';
      setStatusMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside
      className="glass-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Header Profile Summary */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#fff' }}>
              {profile.personalInfo.fullName}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: '500', marginTop: '2px' }}>
              {profile.personalInfo.headline}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              📍 {profile.personalInfo.location} • {profile.careerPreferences.workModel.toUpperCase()}
            </p>
          </div>
          <div className="badge badge-success" title="Grounding is active and verified">
            <ShieldCheckIcon />
            <span>Verified</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            marginTop: '1rem',
            background: 'var(--bg-main)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            overflowX: 'auto',
          }}
        >
          {(['overview', 'skills', 'experience', 'projects', 'documents'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '5px 8px',
                fontSize: '0.75rem',
                fontWeight: activeTab === tab ? '600' : '400',
                color: activeTab === tab ? '#fff' : 'var(--text-muted)',
                background: activeTab === tab ? 'var(--bg-surface-elevated)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
        {statusMessage && (
          <div
            className="badge badge-primary animate-fade-in"
            style={{ width: '100%', marginBottom: '1rem', padding: '8px 12px', justifyContent: 'center' }}
          >
            {statusMessage}
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Professional Bio
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {profile.personalInfo.bio}
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Target Roles
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {profile.careerPreferences.targetRoles.map((role) => (
                  <span key={role} className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                    {role}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Short-Term Goals (6-12 Mo)
              </h3>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {profile.careerPreferences.shortTermGoals.map((goal, idx) => (
                  <li key={idx}>{goal}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Core Values
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {profile.careerPreferences.coreValues.map((v, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '0.72rem',
                      background: 'rgba(255,255,255,0.05)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    ✦ {v}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SKILLS TAB */}
        {activeTab === 'skills' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {profile.skills.map((cat) => (
              <div key={cat.category}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--accent-cyan)', marginBottom: '8px' }}>
                  {cat.category}
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {cat.skills.map((s) => (
                    <span
                      key={s.name}
                      className={`badge ${s.highlight ? 'badge-primary' : ''}`}
                      style={{
                        fontSize: '0.75rem',
                        background: s.highlight ? undefined : 'rgba(255,255,255,0.06)',
                        color: s.highlight ? undefined : 'var(--text-primary)',
                      }}
                    >
                      {s.name}
                      <span style={{ opacity: 0.6, fontSize: '0.65rem', marginLeft: '4px' }}>
                        {s.proficiency}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EXPERIENCE TAB */}
        {activeTab === 'experience' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {profile.experience.map((exp) => (
              <div
                key={exp.id}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
                    {exp.role}
                  </h4>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginBottom: '6px' }}>
                  {exp.company} {exp.location ? `• ${exp.location}` : ''}
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {exp.summary}
                </p>
                <ul style={{ paddingLeft: '1.1rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {exp.achievements.map((a, idx) => (
                    <li key={idx}>{a}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* PROJECTS TAB */}
        {activeTab === 'projects' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {profile.projects.map((proj) => (
              <div
                key={proj.id}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fff' }}>
                    {proj.title}
                  </h4>
                  {proj.featured && <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Featured</span>}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '6px 0' }}>
                  {proj.description}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  {proj.technologies.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: '0.68rem',
                        background: 'rgba(99, 102, 241, 0.1)',
                        color: '#a5b4fc',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <ul style={{ paddingLeft: '1.1rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {proj.outcomesOrImpact.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* DOCUMENTS & CV INGESTION TAB */}
        {activeTab === 'documents' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {profile.documents.length} document{profile.documents.length === 1 ? '' : 's'} in memory
              </span>
              <button
                onClick={() => setIsIngesting(!isIngesting)}
                className="btn btn-primary"
                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              >
                {isIngesting ? 'Cancel' : '+ Ingest CV / Doc'}
              </button>
            </div>

            {/* Ingestion Form */}
            {isIngesting && (
              <form
                onSubmit={handleIngestSubmit}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-bright)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <h4 style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fff' }}>
                  Ingest New Document or CV
                </h4>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Document Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Farhan Resume 2026 Edition"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Document Type
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                      fontSize: '0.8rem',
                    }}
                  >
                    <option value="cv">CV / Resume</option>
                    <option value="cover_letter">Cover Letter</option>
                    <option value="project_spec">Project Specification</option>
                    <option value="note">Career Note / Reference</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Content (Markdown or Plain Text)
                  </label>
                  <textarea
                    placeholder="Paste full CV or career notes here..."
                    rows={6}
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '6px', fontSize: '0.8rem' }}
                >
                  {loading ? 'Ingesting into Knowledge Base...' : 'Ingest Document'}
                </button>
              </form>
            )}

            {/* Existing Documents List */}
            {profile.documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  background: 'var(--bg-surface-elevated)',
                  padding: '0.875rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.825rem', fontWeight: '600', color: '#fff' }}>
                    {doc.title}
                  </span>
                  <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                    {doc.type.toUpperCase()}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginTop: '6px',
                    maxHeight: '60px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {doc.content}
                </p>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                  Ingested on {new Date(doc.addedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
