'use client';

import React, { useState, useEffect } from 'react';
import { CustomShortcut } from '@/lib/shortcuts';
import { SparklesIcon } from './Icons';

export function CustomShortcutsManager() {
  const [shortcuts, setShortcuts] = useState<CustomShortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [triggers, setTriggers] = useState('');
  const [target, setTarget] = useState('');
  const [browser, setBrowser] = useState<'edge' | 'chrome' | 'default'>('edge');
  const [response, setResponse] = useState('');

  const fetchShortcuts = async () => {
    try {
      const res = await fetch('/api/shortcuts');
      const data = await res.json();
      if (data.success) {
        setShortcuts(data.shortcuts || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch shortcuts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShortcuts();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !target.trim() || !triggers.trim()) {
      setStatusMsg({ text: 'Name, triggers, and target URL/app are required.', type: 'error' });
      return;
    }

    try {
      const triggerList = triggers
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const action = target.startsWith('http://') || target.startsWith('https://') || target.startsWith('www.')
        ? 'open_url'
        : 'launch_app';

      const res = await fetch('/api/shortcuts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          triggers: triggerList,
          action,
          target: target.trim(),
          browser,
          response: response.trim() || `Opening ${name.trim()} for you.`,
          enabled: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setStatusMsg({ text: `Shortcut "${name}" saved successfully!`, type: 'success' });
        setName('');
        setTriggers('');
        setTarget('');
        setResponse('');
        setIsAdding(false);
        fetchShortcuts();
      } else {
        setStatusMsg({ text: json.error || 'Failed to save shortcut', type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Error saving shortcut', type: 'error' });
    }
  };

  const handleDelete = async (id: string, scName: string) => {
    if (!confirm(`Delete custom voice shortcut "${scName}"?`)) return;

    try {
      const res = await fetch(`/api/shortcuts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setStatusMsg({ text: `Deleted shortcut "${scName}".`, type: 'success' });
        fetchShortcuts();
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Error deleting shortcut', type: 'error' });
    }
  };

  const handleTest = async (trigger: string) => {
    setStatusMsg({ text: `Testing trigger: "${trigger}"...`, type: 'success' });
    try {
      const res = await fetch('/api/voice/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: trigger }),
      });
      const data = await res.json();
      if (data.responseText) {
        setStatusMsg({ text: `Executed: ${data.responseText}`, type: 'success' });
      }
    } catch (err: any) {
      setStatusMsg({ text: `Test failed: ${err.message}`, type: 'error' });
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
        marginTop: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '600', color: '#fff' }}>Custom Voice Shortcuts & Quick Links</h3>
            <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>0-Token Fast-Path</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
            Say any trigger word (e.g. <code>"Nila"</code> or <code>"open Nila"</code>) to immediately open any custom URL, chat, or application.
          </p>
        </div>

        <button
          onClick={() => {
            setIsAdding(!isAdding);
            setStatusMsg(null);
          }}
          className="btn btn-primary"
          style={{ padding: '6px 14px', fontSize: '0.78rem' }}
        >
          {isAdding ? '✕ Cancel' : '+ Add Voice Shortcut'}
        </button>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.8rem',
            background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: statusMsg.type === 'success' ? '#10b981' : '#ef4444',
            border: `1px solid ${statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          }}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Add Shortcut Form */}
      {isAdding && (
        <form
          onSubmit={handleSave}
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Shortcut Name
              </label>
              <input
                type="text"
                placeholder="e.g. Nila, Work Discord, Spotify Chill"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: '#090d16',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.8rem',
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Voice Trigger Words (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. nila, open nila, message nila"
                value={triggers}
                onChange={(e) => setTriggers(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: '#090d16',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.8rem',
                }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Target Link (URL) or Program Path
              </label>
              <input
                type="text"
                placeholder="e.g. https://www.instagram.com/direct/t/..."
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: '#090d16',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.8rem',
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Browser
              </label>
              <select
                value={browser}
                onChange={(e) => setBrowser(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: '#090d16',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.8rem',
                }}
              >
                <option value="edge">Microsoft Edge (Recommended)</option>
                <option value="chrome">Google Chrome</option>
                <option value="default">System Default Browser</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Spoken Voice Response (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Opening Instagram messages with Nila in Edge."
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                background: '#090d16',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.8rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '6px 16px', fontSize: '0.78rem' }}
            >
              Save Voice Shortcut
            </button>
          </div>
        </form>
      )}

      {/* List of Shortcuts */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Loading custom shortcuts...
        </div>
      ) : shortcuts.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No custom shortcuts yet. Click "+ Add Voice Shortcut" to configure your first command!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {shortcuts.map((sc) => (
            <div
              key={sc.id}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '600', color: '#fff', fontSize: '0.9rem' }}>{sc.name}</span>
                  <span
                    className="badge badge-secondary"
                    style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}
                  >
                    {sc.browser || 'edge'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                  {sc.triggers.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: 'rgba(99, 102, 241, 0.12)',
                        color: '#a5b4fc',
                        fontFamily: 'monospace',
                      }}
                    >
                      "{t}"
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={sc.target}
                >
                  🔗 {sc.target}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleTest(sc.triggers[0])}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                  title="Test voice trigger now"
                >
                  ▶ Test Trigger
                </button>

                <button
                  onClick={() => handleDelete(sc.id, sc.name)}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                  title="Delete shortcut"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Helpful persistence note */}
      <div
        style={{
          marginTop: '1.25rem',
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          📁 Stored permanently in <code>data\custom_shortcuts.json</code>. You can also run <code>scripts\manage-shortcuts.bat</code> or click the Desktop shortcut <b>Auren Shortcuts</b> anytime!
        </span>
        <span style={{ color: '#a5b4fc', fontSize: '0.72rem' }}>Always ready offline</span>
      </div>
    </div>
  );
}
