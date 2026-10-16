import React from 'react';
import { ArrowRight, GitCommit, Check } from 'lucide-react';
import { StatusPill } from './StatusPill';
import { SkillIconTile } from './SkillIconTile';

export interface CompareViewProps {
  onBack?: () => void;
  onViewReport?: () => void;
}

export const CompareView: React.FC<CompareViewProps> = ({ onBack, onViewReport }) => {
  const transitions = [
    {
      skill: 'SQL',
      before: 'PARTIAL' as const,
      after: 'DEMONSTRATED' as const,
    },
    {
      skill: 'Testing',
      before: 'PARTIAL' as const,
      after: 'DEMONSTRATED' as const,
    },
  ];

  const changes = [
    'Added database models and queries',
    'Added unit tests (3 new files)',
    'Updated requirements.txt',
  ];

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '36px 28px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            letterSpacing: '-0.025em',
            margin: '0 0 6px 0',
            color: 'var(--text, #E8EEF9)',
          }}
        >
          Change Detection & Reassessment
        </h1>
        <p style={{ margin: 0, color: 'var(--muted, #8C9AB8)', fontSize: '13.5px' }}>
          Track how your code changes improve your skills.
        </p>
      </div>

      <div className="reference-card" style={{ padding: '24px' }}>
        {/* Commit header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '20px',
            marginBottom: '20px',
            borderBottom: '1px solid var(--border, #1A2748)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-2, #101A30)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #2F6DF6)',
              }}
            >
              <GitCommit size={18} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text, #E8EEF9)' }}>
                New commit detected
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted, #8C9AB8)' }}>
                <span style={{ fontFamily: 'JetBrains Mono' }}>a1b2c3d4</span> • 2 hours ago
              </div>
            </div>
          </div>

          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(52, 211, 153, 0.12)',
              color: '#34D399',
              border: '1px solid rgba(52, 211, 153, 0.3)',
            }}
          >
            Reassessed
          </span>
        </div>

        {/* Before vs After comparison grid */}
        <div style={{ marginBottom: '24px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 32px 1fr',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {transitions.map((t, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 32px 1fr',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: 'var(--surface-2, #101A30)',
                  border: '1px solid var(--border, #1A2748)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <SkillIconTile skill={t.skill} size="sm" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #E8EEF9)', width: '60px' }}>
                    {t.skill}
                  </span>
                  <StatusPill status={t.before} size="sm" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', color: '#34D399' }}>
                  <ArrowRight size={16} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <SkillIconTile skill={t.skill} size="sm" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #E8EEF9)', width: '60px' }}>
                    {t.skill}
                  </span>
                  <StatusPill status={t.after} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Changes list */}
        <div style={{ marginBottom: '24px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {changes.map((change, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(52, 211, 153, 0.15)',
                    color: '#34D399',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={12} strokeWidth={2.5} />
                </div>
                <span style={{ color: 'var(--text, #E8EEF9)' }}>{change}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={onViewReport || onBack}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'var(--surface-2, #101A30)',
              border: '1px solid var(--border, #1A2748)',
              color: 'var(--text, #E8EEF9)',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            View Detailed Report
          </button>
        </div>
      </div>
    </div>
  );
};
