import React from 'react';
import { AgentRow } from './AgentRow';
import { LiveChip } from './LiveChip';

export const AgentActivityView: React.FC = () => {
  const agents = [
    {
      agent: 'Job Analyst',
      message: 'Extracted 6 verified requirements from Kinetik Health posting',
      timestamp: '2m ago',
    },
    {
      agent: 'Repo Scout',
      message: 'Resolved HEAD SHA c3d4e5f on branch main (6 Python files in scope)',
      timestamp: '3m ago',
    },
    {
      agent: 'Change Sentinel',
      message: 'Impact plan: reassessing 4 skills; carrying forward Deployment & CI/CD',
      timestamp: '4m ago',
    },
    {
      agent: 'Evidence Analyst',
      message: 'Found 1 strong SQL signal in app/db.py:12-30 and 1 testing signal in tests/test_db.py:8-24',
      timestamp: '5m ago',
    },
    {
      agent: 'Verifier',
      message: 'Verified cited line ranges at commit c3d4e5f (0 mismatches)',
      timestamp: '6m ago',
    },
    {
      agent: 'Coach',
      message: 'Drafted diff explanation: SQL moved Not demonstrated → Demonstrated',
      timestamp: '7m ago',
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
