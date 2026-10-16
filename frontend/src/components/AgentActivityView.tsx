import React from 'react';
import { AgentRow } from './AgentRow';
import { LiveChip } from './LiveChip';

export const AgentActivityView: React.FC = () => {
  const agents = [
    {
      agent: 'Job Requirements Agent',
      message: 'Parsed 8 key requirements from the job posting',
      timestamp: '2m ago',
    },
    {
      agent: 'Repo Analyzer Agent',
      message: 'Scanned 24 files in the repository',
      timestamp: '3m ago',
    },
    {
      agent: 'Code Analysis Agent',
      message: 'Analyzed code for skill matches',
      timestamp: '4m ago',
    },
    {
      agent: 'Evidence Collector Agent',
      message: 'Found 7 evidence snippets',
      timestamp: '5m ago',
    },
    {
      agent: 'Verifier Agent',
      message: 'Validated 5 citations against source files',
      timestamp: '6m ago',
    },
    {
      agent: 'Impact Analyzer Agent',
      message: 'Detected 2 changed skills (SQL, Testing)',
      timestamp: '7m ago',
    },
    {
      agent: 'Report Generator Agent',
      message: 'Finalizing assessment report...',
      timestamp: '8m ago',
    },
  ];

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '36px 28px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              margin: '0 0 6px 0',
              color: 'var(--text, #E8EEF9)',
            }}
          >
            Agent Activity
          </h1>
          <p style={{ margin: 0, color: 'var(--muted, #8C9AB8)', fontSize: '13.5px' }}>
            Watch the AI agents work in real-time.
          </p>
        </div>

        <LiveChip label="Live" size="md" />
      </div>

      <div className="reference-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {agents.map((item, idx) => (
            <AgentRow
              key={idx}
              agent={item.agent}
              message={item.message}
              timestamp={item.timestamp}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
