'use client';

import React, { useState, useEffect } from 'react';
import { ApplicationItem, ApplicationStatus } from '@/types/tracker';
import { BriefcaseIcon, TrashIcon } from './Icons';

export function ApplicationTrackerView() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New application form
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [location, setLocation] = useState('Remote');
  const [salaryRange, setSalaryRange] = useState('');
  const [matchScore, setMatchScore] = useState(90);

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications');
      const data = await res.json();
      if (res.ok && data.applications) {
        setApplications(data.applications);
      }
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: ApplicationStatus) => {
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateStatus', id, status: newStatus }),
      });
      if (res.ok) {
        fetchApplications();
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      if (res.ok) {
        fetchApplications();
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !role) return;

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          application: {
            company,
            role,
            location,
            workModel: 'remote',
            status: 'saved',
            matchScore: Number(matchScore) || 85,
            salaryRange,
            notes: 'Manually logged opportunity.',
          },
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setCompany('');
        setRole('');
        setSalaryRange('');
        fetchApplications();
      }
    } catch (err) {
      console.error('Failed to create application:', err);
    }
  };

  const statuses: { key: ApplicationStatus; label: string; color: string }[] = [
    { key: 'saved', label: 'Saved / Researching', color: '#94a3b8' },
    { key: 'applied', label: 'Applied', color: '#6366f1' },
    { key: 'interviewing', label: 'Interviewing', color: '#06b6d4' },
    { key: 'offer', label: 'Offer Received', color: '#10b981' },
  ];

  return (
    <div style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#fff' }}>
              Career Application Pipeline
            </h2>
            <span className="badge badge-primary">Stage 2 Operating System</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Track active opportunities, tailored proposals, and interview progress across recruitment stages.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.825rem' }}
        >
          <BriefcaseIcon />
          <span>+ Add Opportunity</span>
        </button>
      </div>

      {/* Kanban Pipeline Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          minWidth: '950px',
        }}
      >
        {statuses.map((col) => {
          const colApps = applications.filter((a) => a.status === col.key);
          return (
            <div
              key={col.key}
              style={{
                background: 'rgba(15, 22, 36, 0.6)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                minHeight: '400px',
              }}
            >
              {/* Column Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: col.color }}>
                  {col.label}
                </span>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', fontSize: '0.7rem' }}>
                  {colApps.length}
                </span>
              </div>

              {/* Cards in Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                {colApps.map((app) => (
                  <div
                    key={app.id}
                    className="glass-panel animate-fade-in"
                    style={{
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      borderLeft: `3px solid ${col.color}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#fff', lineHeight: '1.3' }}>
                        {app.role}
                      </strong>
                      <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                        {app.matchScore}%
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                      {app.company}
                    </div>

                    {app.salaryRange && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)' }}>
                        💰 {app.salaryRange}
                      </div>
                    )}

                    {app.notes && (
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        {app.notes}
                      </p>
                    )}

                    {/* Status Changer & Delete */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <select
                        value={app.status}
                        onChange={(e) => handleUpdateStatus(app.id, e.target.value as ApplicationStatus)}
                        style={{
                          background: 'var(--bg-main)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '0.7rem',
                        }}
                      >
                        <option value="saved">Saved</option>
                        <option value="applied">Applied</option>
                        <option value="interviewing">Interviewing</option>
                        <option value="offer">Offer</option>
                      </select>

                      <button
                        onClick={() => handleDelete(app.id)}
                        className="btn btn-ghost"
                        style={{ padding: '4px', color: 'var(--text-muted)' }}
                        title="Delete application"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Opportunity Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 8, 15, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
        >
          <form
            onSubmit={handleCreate}
            className="glass-panel-elevated animate-fade-in"
            style={{ maxWidth: '440px', width: '100%', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>Add Custom Opportunity</h3>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Company Name</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Role Title</label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Salary Range (Optional)</label>
              <input
                type="text"
                placeholder="e.g. $140,000 - $170,000 USD"
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-main)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: '#fff', fontSize: '0.8rem' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
              <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.78rem' }}>
                Save Opportunity
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
