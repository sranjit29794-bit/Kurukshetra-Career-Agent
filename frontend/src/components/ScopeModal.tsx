import React from 'react';
import { X, ShieldCheck } from 'lucide-react';
import type { ScopeInfo } from '../types';

interface ScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  scope: ScopeInfo;
}

export const ScopeModal: React.FC<ScopeModalProps> = ({ isOpen, onClose, scope }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(3px)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '500px',
          maxWidth: '100%',
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--surface-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
              Analysis Scope & Boundaries
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', fontSize: '13px' }}>
          <p style={{ margin: '0 0 16px 0', color: 'var(--muted)', lineHeight: 1.5 }}>
            To protect against infinite loops, generated files, and credential exposure, Repo Scout applies deterministic file filters and security boundaries per BRAIN §11.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--surface-2)',
                borderRadius: '8px',
                padding: '14px',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--status-demonstrated)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                ANALYZED FILES
              </span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>
                {scope.analyzed}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                Supported code files
              </span>
            </div>

            <div
              style={{
                backgroundColor: 'var(--surface-2)',
                borderRadius: '8px',
                padding: '14px',
                border: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                SKIPPED FILES
              </span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>
                {scope.skipped}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                Filtered out of scope
              </span>
            </div>
          </div>

          <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', color: 'var(--muted)' }}>
            Exclusion & Skip Reasons
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            {Object.keys(scope.skipped_reasons).length > 0 ? (
              Object.entries(scope.skipped_reasons).map(([reason, count]) => (
                <div
                  key={reason}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    backgroundColor: 'var(--surface-2)',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ color: 'var(--text)' }}>{reason}</span>
                  <span style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>{count} files</span>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                No files excluded by policy.
              </div>
            )}
          </div>

          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(45, 212, 191, 0.06)',
              border: '1px solid rgba(45, 212, 191, 0.2)',
              borderRadius: '6px',
              fontSize: '12px',
              color: 'var(--accent)',
            }}
          >
            <strong>Enforced Invariant #5:</strong> Repository code is untrusted data analyzed statically. Code is never imported, executed, or subprocessed.
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'var(--surface-2)',
            borderTop: '1px solid var(--border)',
            textAlign: 'right',
          }}
        >
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'var(--accent)',
              color: '#000',
              fontWeight: 600,
              fontSize: '13px',
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Close Scope Detail
          </button>
        </div>
      </div>
    </div>
  );
};
