import React from 'react';
import {
  GitCommit,
  ArrowRight,
  Check,
  FileText,
} from 'lucide-react';
import { StatusPill } from './StatusPill';
import { SkillIconTile } from './SkillIconTile';
import { ShaChip } from './ShaChip';
import type { Status } from '../types';

export interface ChangeDetectionCardProps {
  sha?: string;
  relativeTime?: string;
  isDocsOnly?: boolean;
  onViewReport?: () => void;
  className?: string;
}

export const ChangeDetectionCard: React.FC<ChangeDetectionCardProps> = ({
  sha = 'c3d4e5f67890123456789abcdef0123456789012',
  relativeTime = '2 hours ago',
  isDocsOnly = false,
  onViewReport,
  className = '',
}) => {

  // Transitions matching §19.1 & §19.2:
  // SQL: NOT_DEMONSTRATED (or PARTIAL in reference.png) → DEMONSTRATED
  // Testing: NOT_DEMONSTRATED → PARTIAL (never DEMONSTRATED per Invariant #6)
  const transitions: Array<{
    skill: string;
    before: Status;
    after: Status;
  }> = [
    {
      skill: 'SQL',
      before: 'NOT_DEMONSTRATED',
      after: 'DEMONSTRATED',
    },
    {
      skill: 'Testing',
      before: 'NOT_DEMONSTRATED',
      after: 'PARTIAL',
    },
  ];

  // Checklist generated directly from diff's files_changed & evidence_added
  // (app/db.py -> database models & queries; tests/test_db.py -> unit tests; app/main.py -> routes)
  const changes = [
    'Added database models and queries',
    'Added unit tests (3 new files)',
    'Updated routes in app/main.py',
  ];

  return (
    <div
      className={`reference-card ${className}`}
      style={{
        padding: '24px',
        backgroundColor: 'var(--surface, #0A1228)',
        border: '1px solid var(--border, #1A2748)',
        borderRadius: '16px',
        position: 'relative',
        boxShadow: '0 4px 20px -2px rgba(5, 10, 26, 0.6)',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '18px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border, #1A2748)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* GitHub / GitCommit Icon Tile */}
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary, #2F6DF6)',
              flexShrink: 0,
            }}
          >
            <GitCommit size={20} />
          </div>

          <div>
            <div
              style={{
                fontSize: '14.5px',
                fontWeight: 700,
                color: 'var(--text, #E8EEF9)',
                lineHeight: 1.3,
              }}
            >
              New commit detected
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--muted, #8C9AB8)',
                marginTop: '2px',
              }}
            >
              <ShaChip sha={sha} size="sm" />
              <span>•</span>
              <span>{relativeTime}</span>
            </div>
          </div>
        </div>

        {/* Reassessed or Docs Only Badge */}
        {isDocsOnly ? (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(148, 163, 184, 0.12)',
              color: '#94A3B8',
              border: '1px dashed #94A3B8',
            }}
          >
            Docs Only — No Skill Change
          </span>
        ) : (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(52, 211, 153, 0.12)',
              color: '#34D399',
              border: '1px solid rgba(52, 211, 153, 0.3)',
            }}
          >
            Reassessed
          </span>
        )}
      </div>

      {isDocsOnly ? (
        /* README-Only Commit State */
        <div
          style={{
            padding: '20px',
            backgroundColor: 'var(--surface-2, #101A30)',
            borderRadius: '12px',
            border: '1px dashed var(--border, #1A2748)',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted, #8C9AB8)', marginBottom: '8px' }}>
            <FileText size={16} />
            <strong style={{ color: 'var(--text, #E8EEF9)' }}>docs only — no skill change</strong>
          </div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted, #8C9AB8)', lineHeight: 1.5 }}>
            Commit touches README.md documentation only. Under DevProof Invariant #7, documentation edits are immune from triggering false skill upgrades.
          </p>
        </div>
      ) : (
        /* Before / After Columns */
        <div style={{ marginBottom: '22px' }}>
          {/* Column Titles */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 36px 1fr',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '10px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--muted, #8C9AB8)',
            }}
          >
            <span>Before</span>
            <span />
            <span>After</span>
          </div>

          {/* Skill Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {transitions.map((t, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 36px 1fr',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: 'var(--surface-2, #101A30)',
                  border: '1px solid var(--border, #1A2748)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Before Column */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <SkillIconTile skill={t.skill} size="sm" />
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text, #E8EEF9)',
                      width: '60px',
                      flexShrink: 0,
                    }}
                  >
                    {t.skill}
                  </span>
                  <div style={{ flexShrink: 0 }}>
                    <StatusPill status={t.before} size="sm" />
                  </div>
                </div>

                {/* Arrow */}
                <div style={{ display: 'flex', justifyContent: 'center', color: '#34D399' }}>
                  <ArrowRight size={16} />
                </div>

                {/* After Column */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <SkillIconTile skill={t.skill} size="sm" />
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text, #E8EEF9)',
                      width: '60px',
                      flexShrink: 0,
                    }}
                  >
                    {t.skill}
                  </span>
                  <div style={{ flexShrink: 0 }}>
                    <StatusPill status={t.after} size="sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Changes Checklist (generated from diff's files_changed & evidence_added) */}
      {!isDocsOnly && (
        <div style={{ marginBottom: '22px' }}>
          <h4
            style={{
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--muted, #8C9AB8)',
              margin: '0 0 10px 0',
            }}
          >
            Changes
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {changes.map((change, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px' }}>
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(52, 211, 153, 0.15)',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    color: '#34D399',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Check size={12} strokeWidth={2.5} />
                </div>
                <span style={{ color: 'var(--text, #E8EEF9)', fontWeight: 500 }}>{change}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button: View Detailed Report */}
      <div>
        <button
          onClick={onViewReport}
          style={{
            width: '100%',
            padding: '11px 16px',
            backgroundColor: 'var(--surface-2, #101A30)',
            border: '1px solid var(--border, #1A2748)',
            color: 'var(--text, #E8EEF9)',
            borderRadius: '10px',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(47, 109, 246, 0.12)';
            e.currentTarget.style.borderColor = 'var(--primary, #2F6DF6)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-2, #101A30)';
            e.currentTarget.style.borderColor = 'var(--border, #1A2748)';
            e.currentTarget.style.color = 'var(--text, #E8EEF9)';
          }}
        >
          <span>View Detailed Report</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
