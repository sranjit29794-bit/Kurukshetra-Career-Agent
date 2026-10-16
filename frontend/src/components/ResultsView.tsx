import React, { useState } from 'react';
import {
  ExternalLink,
  GitCommit,
  Radio,
  Activity,
  ArrowUpDown,
  ArrowLeft,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { EvidenceCard } from './EvidenceCard';
import { CodeViewer } from './CodeViewer';
import { AgentActivityDrawer } from './AgentActivityDrawer';
import { ScopeModal } from './ScopeModal';
import { REPO_CODE_FIXTURES } from '../fixtures/repoCode';
import type { TrackOpportunity, Evidence, ScopeInfo } from '../types';
import eventsFixture from '../../../docs/fixtures/events.json';

interface ResultsViewProps {
  track: TrackOpportunity;
  onBackToDashboard: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ track, onBackToDashboard }) => {
  // Sort toggle: 'gaps_first' vs 'job_order'
  const [sortOrder, setSortOrder] = useState<'gaps_first' | 'job_order'>('gaps_first');

  // Currently selected requirement ID
  const [selectedReqId, setSelectedReqId] = useState<string>(
    track.assessments[0]?.requirement_id || 'req_sql_database'
  );

  // Active citation state for right CodeViewer pane
  const initialEvidence = track.assessments.flatMap((a) => a.evidence)[0];
  const [activeCitation, setActiveCitation] = useState<{
    filePath: string;
    start: number;
    end: number;
    evidenceId?: string;
  }>({
    filePath: initialEvidence?.file_path || 'app/db.py',
    start: initialEvidence?.line_start || 12,
    end: initialEvidence?.line_end || 30,
    evidenceId: initialEvidence?.id,
  });

  // Drawer & Modal state
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState<boolean>(false);

  // Scope information
  const scope: ScopeInfo = {
    analyzed: 6,
    skipped: 2,
    skipped_reasons: {
      'Documentation (*.md)': 1,
      'Virtualenv / packages': 1,
    },
    truncated: false,
  };

  // Find currently active assessment and matching requirement
  const currentAssessment =
    track.assessments.find((a) => a.requirement_id === selectedReqId) || track.assessments[0];
  const currentRequirement = track.job.requirements.find(
    (r) => r.id === currentAssessment.requirement_id
  );

  // Handle citation click from EvidenceCard
  const handleSelectCitation = (ev: Evidence) => {
    setActiveCitation({
      filePath: ev.file_path,
      start: ev.line_start,
      end: ev.line_end,
      evidenceId: ev.id,
    });
  };

  // Sorting logic: gaps first puts NOT_DEMONSTRATED & PARTIAL before DEMONSTRATED
  const sortedAssessments = [...track.assessments].sort((a, b) => {
    if (sortOrder === 'job_order') {
      const posA = track.job.requirements.find((r) => r.id === a.requirement_id)?.position || 0;
      const posB = track.job.requirements.find((r) => r.id === b.requirement_id)?.position || 0;
      return posA - posB;
    }
    // gaps_first: NOT_DEMONSTRATED (0) > PARTIAL (1) > DEMONSTRATED (2) > UNABLE (3)
    const rank = (status: string) => {
      switch (status) {
        case 'NOT_DEMONSTRATED':
          return 0;
        case 'PARTIAL':
          return 1;
        case 'DEMONSTRATED':
          return 2;
        default:
          return 3;
      }
    };
    return rank(a.status) - rank(b.status);
  });

  // Get active code content for Right Pane
  const activeFileFixture = REPO_CODE_FIXTURES[activeCitation.filePath] || {
    path: activeCitation.filePath,
    sha: track.last_seen_sha,
    language: 'python',
    content: `# File: ${activeCitation.filePath}\n# No local fixture snippet available for this path.`,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 85px)' }}>
      {/* ==================================================================== */}
      {/* S3 HEADER BAR per BRAIN §16.3 */}
      {/* ==================================================================== */}
      <div
        style={{
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBackToDashboard}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: '12.5px',
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} />
            <span>Dashboard</span>
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                {track.job.title}
              </h1>
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>at {track.job.company}</span>
              <a
                href={track.job.source_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--accent)',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  textDecoration: 'none',
                }}
              >
                Posting <ExternalLink size={11} />
              </a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              <span>repo: <strong>{track.repo.owner}/{track.repo.name}</strong></span>
              <span>•</span>
              <span>branch: <code>{track.branch}</code></span>
              <span>•</span>
              <span
                title="Click to view scope exclusion boundaries"
                onClick={() => setIsScopeModalOpen(true)}
                style={{
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                Scope: {scope.analyzed} files analyzed, {scope.skipped} skipped
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Analyzed Commit SHA Chip */}
          <a
            href={`https://github.com/${track.repo.owner}/${track.repo.name}/commit/${track.last_seen_sha}`}
            target="_blank"
            rel="noreferrer"
            title="Open commit on GitHub"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              fontFamily: 'JetBrains Mono',
              fontSize: '12px',
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            <GitCommit size={13} />
            <span>{track.last_seen_sha.substring(0, 7)}</span>
            <ExternalLink size={10} style={{ color: 'var(--muted)' }} />
          </a>

          {/* Watcher Chip */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: 'var(--surface-2)',
              border: '1px solid var(--border)',
              fontSize: '12px',
              color: 'var(--text)',
            }}
          >
            <Radio size={12} style={{ color: 'var(--accent)' }} />
            <span>{track.watcher_mode === 'webhook' ? '● Webhook' : '↻ Polling (15s)'}</span>
          </div>

          {/* Agent Activity Drawer Toggle */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: isDrawerOpen ? 'var(--accent)' : 'var(--surface-2)',
              color: isDrawerOpen ? '#000' : 'var(--text)',
              border: '1px solid var(--border)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Activity size={14} />
            <span>Agent Feed</span>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 5px',
                borderRadius: '8px',
                backgroundColor: isDrawerOpen ? '#000' : 'var(--accent)',
                color: isDrawerOpen ? 'var(--accent)' : '#000',
                fontWeight: 700,
              }}
            >
              8
            </span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* THREE-PANE LAYOUT per BRAIN §16.3 */}
      {/* ==================================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '320px 480px 1fr',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* ------------------------------------------------------------------ */}
        {/* LEFT PANE: REQUIREMENTS LIST */}
        {/* ------------------------------------------------------------------ */}
        <div
          style={{
            borderRight: '1px solid var(--border)',
            backgroundColor: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* List Header & Sort Toggle */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--surface-2)',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Requirements ({track.assessments.length})
            </span>

            <button
              onClick={() => setSortOrder(sortOrder === 'gaps_first' ? 'job_order' : 'gaps_first')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <ArrowUpDown size={12} />
              <span>{sortOrder === 'gaps_first' ? 'Gaps first' : 'Job order'}</span>
            </button>
          </div>

          {/* List Items */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sortedAssessments.map((asmt) => {
              const req = track.job.requirements.find((r) => r.id === asmt.requirement_id);
              const isSelected = selectedReqId === asmt.requirement_id;
              const isUpdated = asmt.reassessed && asmt.evidence.length > 0;

              return (
                <div
                  key={asmt.id}
                  onClick={() => {
                    setSelectedReqId(asmt.requirement_id);
                    if (asmt.evidence.length > 0) {
                      handleSelectCitation(asmt.evidence[0]);
                    }
                  }}
                  style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: isSelected ? 'var(--surface-2)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.1s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)' }}>
                      {req ? req.name : asmt.requirement_id}
                    </span>

                    {/* UPDATED / Unchanged Chip */}
                    {isUpdated ? (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(45, 212, 191, 0.15)',
                          color: 'var(--accent)',
                          border: '1px solid var(--accent)',
                        }}
                      >
                        UPDATED
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '10px',
                          color: 'var(--muted)',
                          padding: '1px 4px',
                        }}
                      >
                        Unchanged
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <StatusBadge status={asmt.status} size="sm" showLabel={true} />
                    </div>

                    {req && (
                      <span
                        style={{
                          fontSize: '10.5px',
                          color: 'var(--muted)',
                          backgroundColor: 'var(--surface)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {req.priority.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* CENTER PANE: EVIDENCE CARD */}
        {/* ------------------------------------------------------------------ */}
        <div
          style={{
            borderRight: '1px solid var(--border)',
            backgroundColor: 'var(--bg)',
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          {currentAssessment && (
            <EvidenceCard
              assessment={currentAssessment}
              requirement={currentRequirement}
              onSelectCitation={handleSelectCitation}
              selectedEvidenceId={activeCitation.evidenceId}
              onRetry={() => alert('Retrying deterministic detector pass...')}
            />
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* RIGHT PANE: CODE VIEWER AT ANALYZED SHA */}
        {/* ------------------------------------------------------------------ */}
        <div style={{ overflowY: 'hidden', padding: '16px' }}>
          <CodeViewer
            filePath={activeCitation.filePath}
            sha={track.last_seen_sha}
            code={activeFileFixture.content}
            language={activeFileFixture.language}
            highlightRange={{ start: activeCitation.start, end: activeCitation.end }}
            repoOwner={track.repo.owner}
            repoName={track.repo.name}
          />
        </div>
      </div>

      {/* Scope Boundaries Modal */}
      <ScopeModal
        isOpen={isScopeModalOpen}
        onClose={() => setIsScopeModalOpen(false)}
        scope={scope}
      />

      {/* Agent Activity Drawer */}
      <AgentActivityDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        events={eventsFixture as any}
      />
    </div>
  );
};
