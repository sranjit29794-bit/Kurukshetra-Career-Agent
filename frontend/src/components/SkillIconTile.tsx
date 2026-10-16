import React from 'react';
import {
  Code2,
  Zap,
  Database,
  FlaskConical,
  Box,
  GitBranch,
  Terminal,
} from 'lucide-react';

export interface SkillIconTileProps {
  skill: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface TileStyle {
  bg: string;
  color: string;
  border: string;
  icon: React.ComponentType<{ size: number }>;
}

const getTileStyle = (skill: string): TileStyle => {
  const s = skill.toLowerCase();
  if (s.includes('python')) {
    return {
      bg: 'linear-gradient(135deg, rgba(47, 109, 246, 0.25) 0%, rgba(30, 58, 138, 0.4) 100%)',
      color: '#60A5FA',
      border: 'rgba(59, 130, 246, 0.35)',
      icon: Terminal,
    };
  }
  if (s.includes('fastapi') || s.includes('rest') || s.includes('api')) {
    return {
      bg: 'linear-gradient(135deg, rgba(20, 184, 166, 0.25) 0%, rgba(15, 118, 110, 0.4) 100%)',
      color: '#2DD4BF',
      border: 'rgba(20, 184, 166, 0.35)',
      icon: Zap,
    };
  }
  if (s.includes('sql') || s.includes('database') || s.includes('postgres') || s.includes('db')) {
    return {
      bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(180, 83, 9, 0.4) 100%)',
      color: '#FBBF24',
      border: 'rgba(245, 158, 11, 0.35)',
      icon: Database,
    };
  }
  if (s.includes('test') || s.includes('qa') || s.includes('pytest')) {
    return {
      bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(109, 40, 217, 0.4) 100%)',
      color: '#A78BFA',
      border: 'rgba(139, 92, 246, 0.35)',
      icon: FlaskConical,
    };
  }
  if (s.includes('deploy') || s.includes('docker') || s.includes('devops') || s.includes('cloud')) {
    return {
      bg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25) 0%, rgba(3, 105, 161, 0.4) 100%)',
      color: '#38BDF8',
      border: 'rgba(14, 165, 233, 0.35)',
      icon: Box,
    };
  }
  if (s.includes('git') || s.includes('github')) {
    return {
      bg: 'linear-gradient(135deg, rgba(100, 116, 139, 0.3) 0%, rgba(51, 65, 85, 0.5) 100%)',
      color: '#CBD5E1',
      border: 'rgba(148, 163, 184, 0.3)',
      icon: GitBranch,
    };
  }

  return {
    bg: 'linear-gradient(135deg, rgba(47, 109, 246, 0.2) 0%, rgba(26, 39, 72, 0.5) 100%)',
    color: '#93C5FD',
    border: 'rgba(47, 109, 246, 0.3)',
    icon: Code2,
  };
};

export const SkillIconTile: React.FC<SkillIconTileProps> = ({
  skill,
  size = 'md',
  className = '',
}) => {
  const { bg, color, border, icon: IconComponent } = getTileStyle(skill);

  const dim = size === 'sm' ? 28 : size === 'lg' ? 44 : 36;
  const radius = size === 'sm' ? '8px' : size === 'lg' ? '12px' : '10px';
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;

  return (
    <div
      className={className}
      style={{
        width: `${dim}px`,
        height: `${dim}px`,
        borderRadius: radius,
        background: bg,
        border: `1px solid ${border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
      }}
      title={skill}
    >
      <IconComponent size={iconSize} />
    </div>
  );
};
