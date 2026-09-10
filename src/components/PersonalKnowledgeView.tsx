'use client';

import React, { useState, useEffect } from 'react';
import { DocumentMetadata, DocumentChunk, RetrievalResult } from '@/lib/rag/types';
import { MemoryItem, MemoryCategory, MemoryEvent } from '@/lib/memory/types';
import { SparklesIcon, ShieldCheckIcon } from './Icons';

export function PersonalKnowledgeView() {
  const [activeTab, setActiveTab] = useState<'documents' | 'memories'>('documents');

  // Documents state
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<{ document: DocumentMetadata; chunks: DocumentChunk[] } | null>(null);
  const [docLoadingId, setDocLoadingId] = useState<string | null>(null);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [ingestFilename, setIngestFilename] = useState('');
  const [ingestTitle, setIngestTitle] = useState('');
  const [ingestType, setIngestType] = useState('md');
  const [ingestContent, setIngestContent] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [rebuildLoading, setRebuildLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RetrievalResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Memories state
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [memorySearchQuery, setMemorySearchQuery] = useState('');
  const [showAddMemoryModal, setShowAddMemoryModal] = useState(false);
  const [newMemCategory, setNewMemCategory] = useState<MemoryCategory>('PREFERENCE');
  const [newMemTitle, setNewMemTitle] = useState('');
  const [newMemContent, setNewMemContent] = useState('');
  const [newMemConfidence, setNewMemConfidence] = useState(0.95);
  const [newMemLoading, setNewMemLoading] = useState(false);
  const [auditEvents, setAuditEvents] = useState<{ memoryId: string; events: MemoryEvent[] } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const [notification, setNotification] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Load documents
  const loadDocuments = async () => {
    setDocsLoading(true);
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setDocsLoading(false);
    }
  };

  // Load memories
  const loadMemories = async () => {
    setMemoriesLoading(true);
    try {
      const res = await fetch('/api/memory');
      const data = await res.json();
      if (data.success) {
        setMemories(data.memories || []);
      }
    } catch (err) {
      console.error('Failed to load memories:', err);
    } finally {
      setMemoriesLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    loadMemories();
  }, []);

  // Ingest Document
  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestFilename || !ingestContent) return;

    setIngestLoading(true);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: ingestFilename,
          title: ingestTitle || ingestFilename,
          type: ingestType,
          content: ingestContent,
          source: 'user_upload',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Document '${ingestFilename}' ingested with ${data.result.chunksCreated} chunks!`);
        setShowIngestModal(false);
        setIngestFilename('');
        setIngestTitle('');
        setIngestContent('');
        loadDocuments();
      } else {
        alert(`Ingestion failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Ingestion error: ${err}`);
    } finally {
      setIngestLoading(false);
    }
  };

  // Delete Document
  const handleDeleteDoc = async (id: string, name: string) => {
    if (!confirm(`Delete document '${name}' and its vector chunks?`)) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(`Document '${name}' deleted.`);
        if (selectedDoc?.document.id === id) setSelectedDoc(null);
        loadDocuments();
      }
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  // Inspect Document
  const handleInspectDoc = async (id: string) => {
    setDocLoadingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedDoc({ document: data.document, chunks: data.chunks });
      }
    } catch (err) {
      alert(`Failed to load document details: ${err}`);
    } finally {
      setDocLoadingId(null);
    }
  };

  // Rebuild Index
  const handleRebuildIndex = async () => {
    setRebuildLoading(true);
    try {
      const res = await fetch('/api/documents/rebuild', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Vector index rebuilt with ${data.totalIndexed} chunks!`);
        loadDocuments();
      }
    } catch (err) {
      alert(`Rebuild failed: ${err}`);
    } finally {
      setRebuildLoading(false);
    }
  };

  // Search Knowledge
  const handleSearchKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, topK: 5, minSimilarity: 0.1 }),
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results || []);
      }
    } catch (err) {
      alert(`Search failed: ${err}`);
    } finally {
      setSearchLoading(false);
    }
  };

  // Add Memory
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemTitle || !newMemContent) return;

    setNewMemLoading(true);
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          memory: {
            category: newMemCategory,
            title: newMemTitle,
            content: newMemContent,
            confidence: newMemConfidence,
            verified: true,
            source: 'manual_entry',
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Memory '${newMemTitle}' recorded successfully!`);
        setShowAddMemoryModal(false);
        setNewMemTitle('');
        setNewMemContent('');
        loadMemories();
      }
    } catch (err) {
      alert(`Failed to add memory: ${err}`);
    } finally {
      setNewMemLoading(false);
    }
  };

  // Verify Memory
  const handleVerifyMemory = async (id: string) => {
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Memory verified!');
        loadMemories();
      }
    } catch (err) {
      alert(`Verification failed: ${err}`);
    }
  };

  // Invalidate Memory
  const handleInvalidateMemory = async (id: string) => {
    const reason = prompt('Reason for invalidating this memory:');
    if (reason === null) return;
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalidate', id, reason }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Memory marked as invalidated.');
        loadMemories();
      }
    } catch (err) {
      alert(`Invalidation failed: ${err}`);
    }
  };

  // Delete Memory
  const handleDeleteMemory = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this memory?')) return;
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Memory deleted.');
        loadMemories();
      }
    } catch (err) {
      alert(`Delete failed: ${err}`);
    }
  };

  // View Audit Trail
  const handleViewAudit = async (id: string) => {
    setAuditLoading(true);
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'events', id }),
      });
      const data = await res.json();
      if (data.success) {
        setAuditEvents({ memoryId: id, events: data.events || [] });
      }
    } catch (err) {
      alert(`Failed to load audit trail: ${err}`);
    } finally {
      setAuditLoading(false);
    }
  };

  const categories: MemoryCategory[] = [
    'FACT',
    'PREFERENCE',
    'GOAL',
    'PROJECT',
    'SKILL',
    'EXPERIENCE',
    'CAREER_EVENT',
    'CONVERSATION',
  ];

  const filteredMemories = memories.filter((m) => {
    if (selectedCategory !== 'ALL' && m.category !== selectedCategory) return false;
    if (memorySearchQuery.trim()) {
      const q = memorySearchQuery.toLowerCase();
      return m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q);
    }
    return true;
  });

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunkCount || 0), 0);
  const totalVerifiedMemories = memories.filter((m) => m.verified && m.status === 'active').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Toast */}
      {notification && (
        <div
          className="badge badge-success animate-fade-in"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '10px 18px',
            fontSize: '0.85rem',
            zIndex: 100,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {notification}
        </div>
      )}

      {/* Top Banner & Tab Controls */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(10, 14, 23, 0.6)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--primary)' }}>🧠</span> Personal Knowledge & Memory Engine
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Multi-format Document RAG, deterministic chunking, SQLite vector index, and durable memory with conflict resolution.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setActiveTab('documents')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'documents' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'documents' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              📄 Documents & RAG ({documents.length})
            </button>
            <button
              onClick={() => setActiveTab('memories')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'memories' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'memories' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              💭 Personal Memories ({memories.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {activeTab === 'documents' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div className="card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ingested Documents</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{documents.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>TXT, MD, JSON & PDF</div>
              </div>
              <div className="card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vector Chunks Indexed</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent)', marginTop: '4px' }}>{totalChunks}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>SQLite Canonical Storage</div>
              </div>
              <div className="card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vector Cache</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#10b981', marginTop: '4px' }}>Active</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Cosine Similarity Engine</div>
              </div>
            </div>

            {/* Document Action Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              {/* Semantic Test Query */}
              <form onSubmit={handleSearchKnowledge} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '280px', maxWidth: '580px' }}>
                <input
                  type="text"
                  placeholder="Test semantic retrieval across personal documents..."
                  className="input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1, fontSize: '0.85rem' }}
                />
                <button type="submit" className="btn btn-primary" disabled={searchLoading} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                  {searchLoading ? 'Searching...' : 'Search RAG'}
                </button>
                {searchResults && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setSearchResults(null);
                      setSearchQuery('');
                    }}
                    style={{ fontSize: '0.75rem' }}
                  >
                    Clear
                  </button>
                )}
              </form>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-ghost"
                  onClick={handleRebuildIndex}
                  disabled={rebuildLoading}
                  style={{ fontSize: '0.8rem', border: '1px solid var(--border-subtle)' }}
                >
                  {rebuildLoading ? 'Rebuilding...' : '🔄 Rebuild Index'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowIngestModal(true)}
                  style={{ fontSize: '0.8rem' }}
                >
                  + Ingest Document
                </button>
              </div>
            </div>

            {/* Semantic Search Results (if queried) */}
            {searchResults && (
              <div className="card" style={{ padding: '16px 20px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>
                    Semantic Retrieval Results ({searchResults.length})
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sorted by Cosine Similarity</span>
                </div>

                {searchResults.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    No document chunks matched the query above the similarity threshold.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {searchResults.map((r, i) => (
                      <div
                        key={r.chunkId}
                        style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          padding: '12px 14px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
                            #{i + 1} {r.documentTitle} {r.page ? `• Page ${r.page}` : ''} • Chunk {r.chunkIndex}
                          </span>
                          <span
                            className="badge"
                            style={{
                              background: r.similarity > 0.7 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                              color: r.similarity > 0.7 ? '#34d399' : '#818cf8',
                            }}
                          >
                            {(r.similarity * 100).toFixed(1)}% Match
                          </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {r.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Documents List */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>Ingested Knowledge Documents</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{documents.length} registered</span>
              </div>

              {docsLoading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading documents...</div>
              ) : documents.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '0.9rem' }}>No personal documents ingested yet.</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowIngestModal(true)}
                    style={{ marginTop: '12px', fontSize: '0.8rem' }}
                  >
                    Ingest Your First Document
                  </button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '10px 16px' }}>Document Name</th>
                        <th style={{ padding: '10px 16px' }}>Type</th>
                        <th style={{ padding: '10px 16px' }}>Size</th>
                        <th style={{ padding: '10px 16px' }}>Chunks</th>
                        <th style={{ padding: '10px 16px' }}>Status</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => (
                        <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: '#fff' }}>{doc.title}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{doc.filename}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className="badge" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                              {doc.type}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {(doc.size / 1024).toFixed(1)} KB
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                            {doc.chunkCount || 0} chunks
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className="badge badge-success">{doc.status}</span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button
                              className="btn btn-ghost"
                              onClick={() => handleInspectDoc(doc.id)}
                              disabled={docLoadingId === doc.id}
                              style={{ padding: '4px 10px', fontSize: '0.75rem', marginRight: '6px' }}
                            >
                              {docLoadingId === doc.id ? 'Loading...' : 'Inspect'}
                            </button>
                            <button
                              className="btn btn-ghost"
                              onClick={() => handleDeleteDoc(doc.id, doc.title)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: '#f87171' }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Document Detail Inspector Drawer */}
            {selectedDoc && (
              <div className="card" style={{ padding: '20px', border: '1px solid var(--primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>{selectedDoc.document.title}</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      ID: {selectedDoc.document.id} • SHA-256 Checksum: {selectedDoc.document.checksum?.slice(0, 16)}...
                    </p>
                  </div>
                  <button className="btn btn-ghost" onClick={() => setSelectedDoc(null)} style={{ fontSize: '0.8rem' }}>
                    ✕ Close
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Document Chunks ({selectedDoc.chunks.length})
                  </h4>
                  {selectedDoc.chunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      style={{
                        background: 'rgba(0,0,0,0.25)',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span>Chunk #{chunk.chunkIndex} {chunk.page ? `(Page ${chunk.page})` : ''}</span>
                        <span>~{chunk.tokenEstimate} tokens</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{chunk.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Personal Memories Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Memory Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div className="card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Memories</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{memories.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Durable Context Records</div>
              </div>
              <div className="card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Verified by Candidate</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>{totalVerifiedMemories}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Zero-Hallucination Grounded</div>
              </div>
              <div className="card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Conflict Engine</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>Active</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Automated Supersession Audit</div>
              </div>
            </div>

            {/* Action & Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search memories by keyword..."
                className="input"
                value={memorySearchQuery}
                onChange={(e) => setMemorySearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: '240px', maxWidth: '400px', fontSize: '0.85rem' }}
              />

              <button className="btn btn-primary" onClick={() => setShowAddMemoryModal(true)} style={{ fontSize: '0.8rem' }}>
                + Add Memory
              </button>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSelectedCategory('ALL')}
                className="btn"
                style={{
                  padding: '4px 12px',
                  fontSize: '0.75rem',
                  background: selectedCategory === 'ALL' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.04)',
                  color: selectedCategory === 'ALL' ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                ALL ({memories.length})
              </button>
              {categories.map((cat) => {
                const count = memories.filter((m) => m.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="btn"
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.75rem',
                      background: selectedCategory === cat ? 'var(--primary)' : 'rgba(255, 255, 255, 0.04)',
                      color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
            </div>

            {/* Memories List */}
            {memoriesLoading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading memories...</div>
            ) : filteredMemories.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }} className="card">
                No memories found matching the filter.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                {filteredMemories.map((m) => {
                  const isSuperseded = m.status === 'superseded';
                  const isInvalid = m.status === 'invalidated';

                  return (
                    <div
                      key={m.id}
                      className="card"
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        opacity: isSuperseded || isInvalid ? 0.6 : 1,
                        border: isSuperseded ? '1px dashed #f59e0b' : isInvalid ? '1px dashed #ef4444' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        {/* Badges Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.7rem',
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: 'var(--primary)',
                            }}
                          >
                            {m.category}
                          </span>

                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {m.verified && (
                              <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                                ✓ Verified
                              </span>
                            )}
                            {isSuperseded && (
                              <span
                                className="badge"
                                style={{ fontSize: '0.68rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}
                              >
                                Superseded
                              </span>
                            )}
                            {isInvalid && (
                              <span className="badge badge-danger" style={{ fontSize: '0.68rem' }}>
                                Invalidated
                              </span>
                            )}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {Math.round(m.confidence * 100)}% Conf
                            </span>
                          </div>
                        </div>

                        {/* Title & Content */}
                        <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: '#fff', marginBottom: '6px' }}>{m.title}</h4>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {m.content}
                        </p>

                        {/* Superseded Warning */}
                        {isSuperseded && m.supersededBy && (
                          <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#fbbf24' }}>
                            ⚠️ Superseded by newer memory: #{m.supersededBy.slice(-6)}
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div
                        style={{
                          marginTop: '14px',
                          paddingTop: '10px',
                          borderTop: '1px solid var(--border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Source: {m.source}
                        </span>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          {!m.verified && !isSuperseded && !isInvalid && (
                            <button
                              className="btn btn-ghost"
                              onClick={() => handleVerifyMemory(m.id)}
                              style={{ padding: '3px 8px', fontSize: '0.72rem', color: '#34d399' }}
                            >
                              Verify
                            </button>
                          )}
                          {!isInvalid && (
                            <button
                              className="btn btn-ghost"
                              onClick={() => handleInvalidateMemory(m.id)}
                              style={{ padding: '3px 8px', fontSize: '0.72rem', color: '#fbbf24' }}
                            >
                              Invalidate
                            </button>
                          )}
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleViewAudit(m.id)}
                            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                          >
                            Audit
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleDeleteMemory(m.id)}
                            style={{ padding: '3px 8px', fontSize: '0.72rem', color: '#f87171' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Audit Trail Modal */}
            {auditEvents && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 90,
                  padding: '20px',
                }}
              >
                <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '24px', maxHeight: '80vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>Memory Provenance & Audit Trail</h3>
                    <button className="btn btn-ghost" onClick={() => setAuditEvents(null)}>✕</button>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Full lifecycle history for memory ID: {auditEvents.memoryId}
                  </p>

                  {auditEvents.events.length === 0 ? (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No audit events logged for this record.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {auditEvents.events.map((evt) => (
                        <div
                          key={evt.id}
                          style={{
                            background: 'rgba(0,0,0,0.25)',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.78rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--primary)', textTransform: 'uppercase' }}>
                              {evt.eventType}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                              {new Date(evt.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <pre style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(evt.details, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ingest Document Modal */}
      {showIngestModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 90,
            padding: '20px',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '580px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>Ingest Personal Knowledge Document</h3>
              <button className="btn btn-ghost" onClick={() => setShowIngestModal(false)}>✕</button>
            </div>

            <form onSubmit={handleIngest} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Document Filename *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Farhan_CV_2026.md, portfolio.json, system_spec.txt"
                  className="input"
                  required
                  value={ingestFilename}
                  onChange={(e) => setIngestFilename(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Title
                  </label>
                  <input
                    type="text"
                    placeholder="Readable document title"
                    className="input"
                    value={ingestTitle}
                    onChange={(e) => setIngestTitle(e.target.value)}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Format Type
                  </label>
                  <select
                    className="input"
                    value={ingestType}
                    onChange={(e) => setIngestType(e.target.value)}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="md">Markdown (.md)</option>
                    <option value="txt">Plain Text (.txt)</option>
                    <option value="json">JSON (.json)</option>
                    <option value="pdf">PDF (.pdf)</option>
                    <option value="cv">CV / Resume</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Document Text Content *
                </label>
                <textarea
                  rows={8}
                  placeholder="Paste raw document content, markdown text, or JSON payload here..."
                  className="input"
                  required
                  value={ingestContent}
                  onChange={(e) => setIngestContent(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowIngestModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={ingestLoading}>
                  {ingestLoading ? 'Ingesting & Chunking...' : 'Ingest & Index'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Memory Modal */}
      {showAddMemoryModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 90,
            padding: '20px',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '520px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>Record Personal Memory</h3>
              <button className="btn btn-ghost" onClick={() => setShowAddMemoryModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAddMemory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Category *
                </label>
                <select
                  className="input"
                  value={newMemCategory}
                  onChange={(e) => setNewMemCategory(e.target.value as MemoryCategory)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Preferred Language, Target Compensation"
                  className="input"
                  required
                  value={newMemTitle}
                  onChange={(e) => setNewMemTitle(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Memory Content / Factual Statement *
                </label>
                <textarea
                  rows={4}
                  placeholder="e.g. Farhan prefers TypeScript and Next.js App Router for new web application architectures."
                  className="input"
                  required
                  value={newMemContent}
                  onChange={(e) => setNewMemContent(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Confidence Level</span>
                  <span>{Math.round(newMemConfidence * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={newMemConfidence}
                  onChange={(e) => setNewMemConfidence(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddMemoryModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={newMemLoading}>
                  {newMemLoading ? 'Saving...' : 'Save Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
