'use client';

import React from 'react';
import { ShieldCheckIcon } from './Icons';

interface HumanApprovalModalProps {
  request: {
    actionType: 'submit_application' | 'send_message' | 'export_proposal' | 'accept_contract' | 'create_application' | 'update_application_status' | 'generate_proposal' | string;
    title: string;
    description: string;
    payload: Record<string, unknown>;
  };
  onApprove: () => void;
  onReject: () => void;
}

export function HumanApprovalModal({ request, onApprove, onReject }: HumanApprovalModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 15, 0.8)',
        backdropFilter: 'blur(10px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="glass-panel-elevated animate-fade-in"
        style={{
          maxWidth: '560px',
          width: '100%',
          padding: '2rem',
          border: '1px solid var(--border-bright)',
          boxShadow: '0 0 40px rgba(99, 102, 241, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheckIcon />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>
              Human Approval Required
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: '500' }}>
              Action Guardrail: {request.actionType.toUpperCase().replace('_', ' ')}
            </span>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.5' }}>
          {request.description}
        </p>

        {/* Payload Preview */}
        <div
          style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            maxHeight: '220px',
            overflowY: 'auto',
            fontSize: '0.8rem',
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-mono)',
            marginBottom: '1.5rem',
          }}
        >
          {String(request.payload.content || JSON.stringify(request.payload, null, 2))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onReject}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Cancel / Reject
          </button>
          <button
            onClick={onApprove}
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '0.85rem' }}
          >
            Approve & Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
