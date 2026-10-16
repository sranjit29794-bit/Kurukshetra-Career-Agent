import React from 'react';
import {
  X,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  AlertCircle,
  Clock,
} from 'lucide-react';

export interface AgentEventItem {
  id: number | string;
  agent: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  ts: string;
}

interface AgentActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: AgentEventItem[];
}

export const AgentActivityDrawer: React.FC<AgentActivityDrawerProps> = ({
  isOpen,
  onClose,
  events,
}) => {
  if (!isOpen) return null;

  const getAgentColor = (agent: string) => {
    switch (agent) {
      case 'Repo Scout':
        return '#60A5FA'; // blue
      case 'Change Sentinel':
        return '#F472B6'; // pink
      case 'Evidence Analyst':
        return '#2DD4BF'; // teal
      case 'Verifier':
        return '#FBBF24'; // amber
      case 'Coach':
        return '#A78BFA'; // violet
      case 'Orchestrator':
      default:
        return '#34D399'; // emerald
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 size={13} style={{ color: '#34D399' }} />;
      case 'warn':
        return <AlertTriangle size={13} style={{ color: '#FBBF24' }} />;
      case 'error':
        return <AlertCircle size={13} style={{ color: '#EF4444' }} />;
      case 'info':
      default:
        return <Info size={13} style={{ color: '#60A5FA' }} />;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '400px',
        maxWidth: '90vw',
        backgroundColor: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.5)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Drawer Header */}
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
          <Activity size={18} style={{ color: 'var(--accent)' }} />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
            Agent Activity Feed
          </h3>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '10px',
              backgroundColor: 'rgba(45, 212, 191, 0.15)',
              color: 'var(--accent)',
              fontWeight: 600,
            }}
          >
            {events.length}
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Drawer Description */}
      <div
        style={{
          padding: '10px 20px',
          backgroundColor: 'rgba(45, 212, 191, 0.05)',
          borderBottom: '1px solid var(--border)',
          fontSize: '12px',
          color: 'var(--muted)',
        }}
      >
        Real-time multi-agent execution pipeline. Judges can observe autonomous verifications and heuristic steps.
      </div>

      {/* Events List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {events.map((ev) => {
          const agentColor = getAgentColor(ev.agent);
          return (
            <div
              key={ev.id}
              style={{
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: agentColor,
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: agentColor,
                    }}
                  />
                  {ev.agent}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)' }}>
                  {getLevelIcon(ev.level)}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <Clock size={10} /> {ev.ts.split('T')[1]?.substring(0, 8) || ev.ts}
                  </span>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.45 }}>
                {ev.message}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
