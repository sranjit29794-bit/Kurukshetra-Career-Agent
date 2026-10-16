import { useState } from 'react';
import {
  CheckCircle2,
  CircleDot,
  Circle,
  RefreshCw,
  Cpu,
  GitCommit,
  ExternalLink,
  Code2
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'compare'>('dashboard');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
      {/* Top Bar per BRAIN §16.2 */}
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent)',
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '16px',
              }}
            >
              D
            </div>
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em' }}>
              DevProof
            </span>
          </div>
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Your code. Your proof.
          </span>
        </div>

        {/* Global Status Chips per BRAIN §16.2 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            <RefreshCw size={13} style={{ color: 'var(--accent)' }} />
            <span>Polling · next in 15s</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            <Cpu size={13} style={{ color: '#34D399' }} />
            <span>AI active</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            <GitCommit size={13} />
            <span>4,982 / 5,000 req</span>
          </div>
        </div>
      </header>

      {/* Persistent Absence ≠ Failure Banner per BRAIN §16.2 */}
      <div
        style={{
          backgroundColor: 'rgba(45, 212, 191, 0.08)',
          borderBottom: '1px solid rgba(45, 212, 191, 0.2)',
          padding: '8px 24px',
          fontSize: '13px',
          color: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>💡</span>
        <span>
          <strong>Notice:</strong> Not demonstrated means not found in the analyzed scope — it doesn't prove you lack the skill.
        </span>
      </div>

      {/* Main Content Shell */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 6px 0' }}>
              Backend Engineering Intern (Python/FastAPI)
            </h1>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>Kinetik Health</span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <GitCommit size={14} /> Commit: <code style={{ color: 'var(--accent)' }}>c3d4e5f</code>
              </span>
              <span>•</span>
              <span>6 files analyzed</span>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('dashboard')}
              style={{
                backgroundColor: activeTab === 'dashboard' ? 'var(--accent)' : 'var(--surface)',
                color: activeTab === 'dashboard' ? '#000' : 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              Assessment Cards
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              style={{
                backgroundColor: activeTab === 'compare' ? 'var(--accent)' : 'var(--surface)',
                color: activeTab === 'compare' ? '#000' : 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              Compare View (Diff)
            </button>
          </div>
        </div>

        {/* Demo Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
          {/* Card 1: REST API (Demonstrated) */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600, fontSize: '16px' }}>REST APIs</span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--status-demonstrated)',
                  backgroundColor: 'rgba(52, 211, 153, 0.1)',
                  padding: '3px 8px',
                  borderRadius: '12px',
                }}
              >
                <CheckCircle2 size={13} /> Demonstrated
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
              FastAPI application with multiple typed endpoints and Pydantic request models.
            </p>
            <div
              style={{
                backgroundColor: 'var(--surface-2)',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code2 size={14} /> app/main.py:15-32
              </span>
              <span style={{ color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                View <ExternalLink size={12} />
              </span>
            </div>
          </div>

          {/* Card 2: SQL Database (Demonstrated) */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--accent)',
              boxShadow: '0 0 15px rgba(45, 212, 191, 0.15)',
              borderRadius: 'var(--radius)',
              padding: '20px',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600, fontSize: '16px' }}>SQL Database</span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--status-demonstrated)',
                  backgroundColor: 'rgba(52, 211, 153, 0.1)',
                  padding: '3px 8px',
                  borderRadius: '12px',
                }}
              >
                <CheckCircle2 size={13} /> Demonstrated
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
              Parameterized SQL queries implemented in db.py using sqlite3 with proper placeholder binding (? args).
            </p>
            <div
              style={{
                backgroundColor: 'var(--surface-2)',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code2 size={14} /> app/db.py:12-30
              </span>
              <span style={{ color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                View <ExternalLink size={12} />
              </span>
            </div>
          </div>

          {/* Card 3: Testing (Partially demonstrated) */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600, fontSize: '16px' }}>Testing</span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--status-partial)',
                  backgroundColor: 'rgba(251, 191, 36, 0.1)',
                  padding: '3px 8px',
                  borderRadius: '12px',
                }}
              >
                <CircleDot size={13} /> Partially demonstrated
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
              Automated unit tests added in tests/test_db.py with assertions against a temporary database.
            </p>
            <div
              style={{
                backgroundColor: 'rgba(251, 191, 36, 0.08)',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                color: 'var(--status-partial)',
                marginBottom: '8px',
              }}
            >
              ⚠️ Capped at Partial: Tests present in repo but not executed via CI check-runs.
            </div>
          </div>

          {/* Card 4: Deployment (Not demonstrated - SLATE DASHED) */}
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px dashed var(--status-not-demonstrated)',
              borderRadius: 'var(--radius)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 600, fontSize: '16px' }}>Deployment</span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--status-not-demonstrated)',
                  backgroundColor: 'rgba(148, 163, 184, 0.1)',
                  padding: '3px 8px',
                  borderRadius: '12px',
                }}
              >
                <Circle size={13} style={{ strokeDasharray: '2 2' }} /> Not demonstrated
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 12px 0' }}>
              No containerization or deployment configurations discovered in analyzed files.
            </p>
            <div
              style={{
                backgroundColor: 'rgba(45, 212, 191, 0.05)',
                border: '1px solid rgba(45, 212, 191, 0.15)',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                color: 'var(--accent)',
              }}
            >
              Next step: Add a Dockerfile or deployment manifest to demonstrate deployment readiness.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
