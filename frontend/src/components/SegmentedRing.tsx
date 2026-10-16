import React from 'react';
import { ArrowUp } from 'lucide-react';

export interface SegmentedRingProps {
  demonstrated: number;
  partial: number;
  notDemonstrated: number;
  unable?: number;
  total?: number;
  className?: string;
}

export const SegmentedRing: React.FC<SegmentedRingProps> = ({
  demonstrated,
  partial,
  notDemonstrated,
  unable = 0,
  total: propTotal,
  className = '',
}) => {
  const total = propTotal ?? (demonstrated + partial + notDemonstrated + unable);
  const size = 96;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Safe fractions for the segments
  const calcOffset = (value: number) => (total > 0 ? (value / total) * circumference : 0);

  const demLength = calcOffset(demonstrated);
  const partLength = calcOffset(partial);
  const notDemLength = calcOffset(notDemonstrated);
  const unableLength = calcOffset(unable);

  // Rotation offsets: start at top (-90deg)
  const partOffset = demLength;
  const notDemOffset = demLength + partLength;
  const unableOffset = demLength + partLength + notDemLength;

  const needsAttention = partial + notDemonstrated + unable;

  return (
    <div
      className={`reference-card ${className}`}
      style={{
        padding: '22px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
      }}
    >
      {/* SVG Donut Ring */}
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(26, 39, 72, 0.6)"
            strokeWidth={strokeWidth}
          />

          {/* Not Demonstrated (Slate) */}
          {notDemLength > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#64748B"
              strokeWidth={strokeWidth}
              strokeDasharray={`${notDemLength} ${circumference}`}
              strokeDashoffset={-notDemOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="round"
            />
          )}

          {/* Partial (Amber) */}
          {partLength > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#FBBF24"
              strokeWidth={strokeWidth}
              strokeDasharray={`${partLength} ${circumference}`}
              strokeDashoffset={-partOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="round"
            />
          )}

          {/* Unable (Violet) */}
          {unableLength > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#A78BFA"
              strokeWidth={strokeWidth}
              strokeDasharray={`${unableLength} ${circumference}`}
              strokeDashoffset={-unableOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="round"
            />
          )}

          {/* Demonstrated (Emerald) */}
          {demLength > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#34D399"
              strokeWidth={strokeWidth}
              strokeDasharray={`${demLength} ${circumference}`}
              strokeDashoffset={0}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Center label (NO PERCENTAGE EVER per BRAIN §3) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--text, #E8EEF9)',
              lineHeight: 1,
            }}
          >
            {demonstrated}/{total}
          </span>
        </div>
      </div>

      {/* Right Column Summary */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '26px',
            fontWeight: 800,
            color: 'var(--text, #E8EEF9)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: '4px',
          }}
        >
          {demonstrated}/{total}
        </div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text, #E8EEF9)',
            marginBottom: '6px',
          }}
        >
          Skills Demonstrated
        </div>
        <div
          style={{
            fontSize: '12px',
            color: needsAttention > 0 ? '#FBBF24' : '#34D399',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 500,
          }}
        >
          {needsAttention > 0 ? (
            <>
              <ArrowUp size={12} strokeWidth={2.5} />
              <span>{needsAttention} need attention</span>
            </>
          ) : (
            <span>All requirements demonstrated</span>
          )}
        </div>
      </div>
    </div>
  );
};
