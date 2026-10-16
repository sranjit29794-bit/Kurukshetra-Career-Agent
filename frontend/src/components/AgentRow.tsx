import React from 'react';
import {
  Code2,
  FileSearch,
  CheckCircle2,
  Zap,
  FileText,
  Bot,
} from 'lucide-react';

export interface AgentRowProps {
  agent: string;
  message: string;
  timestamp: string;
  level?: 'info' | 'warn' | 'error';
  className?: string;
}

const getAgentStyle = (agent: string) => {
  const a = agent.toLowerCase();
  if (a.includes('code') || a.includes('repo')) {
    return {
      bg: 'linear-gradient(135deg, rgba(47, 109, 246, 0.25) 0%, rgba(30, 58, 138, 0.4) 100%)',
      color: '#60A5FA',
      icon: Code2,
    };
  }
  if (a.includes('evidence') || a.includes('collector')) {
    return {
      bg: 'linear-gradient(135deg, rgba(20, 184, 166, 0.25) 0%, rgba(15, 118, 110, 0.4) 100%)',
      color: '#2DD4BF',
      icon: FileSearch,
    };
  }
  if (a.includes('verifier') || a.includes('verify')) {
    return {
      bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(109, 40, 217, 0.4) 100%)',
      color: '#A78BFA',
      icon: CheckCircle2,
    };
  }
  if (a.includes('impact') || a.includes('analyzer')) {
    return {
      bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(180, 83, 9, 0.4) 100%)',
      color: '#FBBF24',
      icon: Zap,
    };
  }
  if (a.includes('job') || a.includes('requirement')) {
    return {
      bg: 'linear-gradient(135deg, rgba(52, 211, 153, 0.25) 0%, rgba(16, 149, 106, 0.4) 100%)',
      color: '#34D399',
      icon: FileText,
    };
  }
  return {
    bg: 'linear-gradient(135deg, rgba(47, 109, 246, 0.2) 0%, rgba(26, 39, 72, 0.4) 100%)',
    color: '#93C5FD',
    icon: Bot,
  };
};

export const AgentRow: React.FC<AgentRowProps> = ({
  agent,
  message,
  timestamp,
  className = '',
}) => {
  const { bg, color, icon: IconComponent } = getAgentStyle(agent);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 0',
        borderBottom: '1px solid rgba(26, 39, 72, 0.5)',
      }}
    >
      {/* Agent Tile */}
      <div
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '10px',
          background: bg,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          flexShrink: 0,
        }}
      >
        <IconComponent size={17} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text, #E8EEF9)',
            lineHeight: 1.25,
            marginBottom: '2px',
          }}
        >
          {agent}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'var(--muted, #8C9AB8)',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {message}
        </div>
      </div>

      {/* Relative Time */}
      <div
        style={{
          fontSize: '11px',
          color: 'var(--muted, #8C9AB8)',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {timestamp}
      </div>
    </div>
  );
};
